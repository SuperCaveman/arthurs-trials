import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createFileResultsStore, createInMemoryResultsStore } from './results-store.mjs';

const PLAYER_ID_PATTERN = /^[A-Za-z0-9._-]{3,64}$/;
const EVENT_ID_PATTERN = /^[A-Za-z0-9-]{16,128}$/;
const MAX_PARTY_SIZE = 4;

function validateCompletedMatch(event) {
  if (event?.eventType !== 'match.completed') {
    throw new Error('Only match.completed events are supported.');
  }
  if (typeof event.eventId !== 'string' || !EVENT_ID_PATTERN.test(event.eventId)) {
    throw new Error('eventId must be UUID-shaped.');
  }
  if (typeof event.matchId !== 'string' || !/^mrq_[A-Za-z0-9-]+$/.test(event.matchId)) {
    throw new Error('matchId must be an Arthur’s Trials match request identifier.');
  }
  if (!Array.isArray(event.participants) || event.participants.length < 1 || event.participants.length > MAX_PARTY_SIZE) {
    throw new Error('participants must contain between one and four players.');
  }
  if (!event.participants.every((playerId) => typeof playerId === 'string' && PLAYER_ID_PATTERN.test(playerId))) {
    throw new Error('participants contains an invalid player identifier.');
  }
  if (new Set(event.participants).size !== event.participants.length) {
    throw new Error('participants must not contain duplicates.');
  }
  if (!Number.isInteger(event.xpAward) || event.xpAward < 0 || event.xpAward > 10_000) {
    throw new Error('xpAward must be an integer between 0 and 10000.');
  }
  if (Number.isNaN(Date.parse(event.completedAt))) {
    throw new Error('completedAt must be an ISO-8601 timestamp.');
  }
}

export { createFileResultsStore, createInMemoryResultsStore } from './results-store.mjs';

export function createResultsWorker({ store = createInMemoryResultsStore(), logger = console } = {}) {
  return {
    async process(event) {
      validateCompletedMatch(event);

      if (!(await store.applyOnce(event))) {
        logger.info?.({ event: 'match_result_duplicate', eventId: event.eventId, matchId: event.matchId });
        return { disposition: 'DUPLICATE', eventId: event.eventId, matchId: event.matchId };
      }

      logger.info?.({
        event: 'match_result_processed',
        eventId: event.eventId,
        matchId: event.matchId,
        participantCount: event.participants.length,
      });
      return { disposition: 'PROCESSED', eventId: event.eventId, matchId: event.matchId };
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const storeName = process.env.RESULTS_STORE ?? 'memory';
  if (!['memory', 'file'].includes(storeName)) throw new Error('RESULTS_STORE must be memory or file.');
  const store = storeName === 'file'
    ? createFileResultsStore({ path: process.env.RESULTS_STORE_PATH })
    : createInMemoryResultsStore();
  // Keep stdout to one result record per input event. Infrastructure runners
  // can then consume it safely without parsing diagnostic logs as data.
  const quietLogger = { info() {} };
  const worker = createResultsWorker({ store, logger: quietLogger });
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });

  for await (const line of input) {
    if (!line.trim()) continue;
    try {
      const result = await worker.process(JSON.parse(line));
      process.stdout.write(`${JSON.stringify(result)}\n`);
    } catch (error) {
      process.stderr.write(`${JSON.stringify({ event: 'match_result_rejected', message: error.message })}\n`);
      process.exitCode = 1;
    }
  }
}
