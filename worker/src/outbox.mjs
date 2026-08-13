import { mkdir, readdir, readFile, rename } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createResultsWorker } from './worker.mjs';

async function moveEvent(sourcePath, destinationDirectory) {
  await mkdir(destinationDirectory, { recursive: true });
  const destinationPath = join(destinationDirectory, basename(sourcePath));
  await rename(sourcePath, destinationPath);
  return destinationPath;
}

/**
 * Local stand-in for SQS consumption. The Unreal dedicated server publishes
 * immutable JSON events to an outbox; this worker drains them through the same
 * idempotent result processor used by the future queue consumer.
 */
export async function drainMatchResultsOutbox({ outboxDirectory, worker = createResultsWorker(), logger = console } = {}) {
  if (!outboxDirectory) throw new Error('outboxDirectory is required.');

  await mkdir(outboxDirectory, { recursive: true });
  const processedDirectory = join(outboxDirectory, 'processed');
  const rejectedDirectory = join(outboxDirectory, 'rejected');
  const entries = await readdir(outboxDirectory, { withFileTypes: true });
  const eventFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => join(outboxDirectory, entry.name))
    .sort();

  const results = [];
  for (const eventPath of eventFiles) {
    try {
      const event = JSON.parse(await readFile(eventPath, 'utf8'));
      const result = await worker.process(event);
      await moveEvent(eventPath, processedDirectory);
      logger.info?.({ event: 'match_result_outbox_processed', file: basename(eventPath), disposition: result.disposition });
      results.push(result);
    } catch (error) {
      await moveEvent(eventPath, rejectedDirectory);
      logger.error?.({ event: 'match_result_outbox_rejected', file: basename(eventPath), message: error.message });
      results.push({ disposition: 'REJECTED', file: basename(eventPath), message: error.message });
    }
  }

  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outboxDirectory = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '../../game/ArthursTrials/Saved/MatchResultsOutbox');
  const storeName = process.env.RESULTS_STORE ?? 'memory';
  if (!['memory', 'file'].includes(storeName)) throw new Error('RESULTS_STORE must be memory or file.');
  const store = storeName === 'file'
    ? (await import('./results-store.mjs')).createFileResultsStore({ path: process.env.RESULTS_STORE_PATH })
    : (await import('./results-store.mjs')).createInMemoryResultsStore();
  // stdout remains one machine-readable summary, so a recording can safely
  // pipe it into PowerShell without showing per-event identifiers.
  const quietLogger = { info() {}, error() {} };
  const results = await drainMatchResultsOutbox({
    outboxDirectory,
    worker: createResultsWorker({ store, logger: quietLogger }),
    logger: quietLogger,
  });
  process.stdout.write(`${JSON.stringify({ event: 'match_results_outbox_drained', count: results.length, results })}\n`);
}
