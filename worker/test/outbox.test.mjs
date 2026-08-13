import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { drainMatchResultsOutbox } from '../src/outbox.mjs';
import { createInMemoryResultsStore, createResultsWorker } from '../src/worker.mjs';

function completedMatch(eventId = '17ea8ce7-6f3f-4b2a-9c93-5c3ed89f4691') {
  return {
    eventType: 'match.completed',
    eventId,
    matchId: `mrq_${eventId}`,
    participants: ['andrew'],
    xpAward: 125,
    completedAt: '2026-08-12T18:00:00.000Z',
  };
}

test('drains authoritative outbox events and preserves exactly-once reward handling', async () => {
  const outboxDirectory = await mkdtemp(join(tmpdir(), 'arthurs-trials-outbox-'));
  const event = completedMatch();
  await writeFile(join(outboxDirectory, 'first.json'), JSON.stringify(event));
  await writeFile(join(outboxDirectory, 'duplicate.json'), JSON.stringify(event));

  const store = createInMemoryResultsStore();
  const worker = createResultsWorker({ store, logger: { info() {} } });
  const results = await drainMatchResultsOutbox({ outboxDirectory, worker, logger: { info() {}, error() {} } });

  assert.deepEqual(results.map((result) => result.disposition), ['PROCESSED', 'DUPLICATE']);
  assert.equal(store.getXp('andrew'), 125);
  assert.deepEqual(JSON.parse(await readFile(join(outboxDirectory, 'processed', 'first.json'), 'utf8')), event);
  assert.deepEqual(JSON.parse(await readFile(join(outboxDirectory, 'processed', 'duplicate.json'), 'utf8')), event);
});

test('quarantines malformed outbox payloads without changing rewards', async () => {
  const outboxDirectory = await mkdtemp(join(tmpdir(), 'arthurs-trials-outbox-'));
  await writeFile(join(outboxDirectory, 'invalid.json'), '{not json');
  const store = createInMemoryResultsStore();
  const worker = createResultsWorker({ store, logger: { info() {} } });

  const results = await drainMatchResultsOutbox({ outboxDirectory, worker, logger: { info() {}, error() {} } });

  assert.equal(results[0].disposition, 'REJECTED');
  assert.equal(store.getXp('andrew'), 0);
  assert.equal(await readFile(join(outboxDirectory, 'rejected', 'invalid.json'), 'utf8'), '{not json');
});
