import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryResultsStore, createResultsWorker } from '../src/worker.mjs';

function completedMatch(overrides = {}) {
  return {
    eventType: 'match.completed',
    eventId: '17ea8ce7-6f3f-4b2a-9c93-5c3ed89f4691',
    matchId: 'mrq_17ea8ce7-6f3f-4b2a-9c93-5c3ed89f4691',
    participants: ['andrew', 'arthur'],
    xpAward: 125,
    completedAt: '2026-08-10T18:00:00.000Z',
    ...overrides,
  };
}

test('grants match XP once and reports a duplicate safely', () => {
  const store = createInMemoryResultsStore();
  const worker = createResultsWorker({ store, logger: { info() {} } });
  const event = completedMatch();

  assert.equal(worker.process(event).disposition, 'PROCESSED');
  assert.equal(worker.process(event).disposition, 'DUPLICATE');
  assert.equal(store.getXp('andrew'), 125);
  assert.equal(store.getXp('arthur'), 125);
});

test('rejects malformed or unsupported events before modifying rewards', () => {
  const store = createInMemoryResultsStore();
  const worker = createResultsWorker({ store, logger: { info() {} } });

  assert.throws(() => worker.process(completedMatch({ eventType: 'match.started' })), /match.completed/);
  assert.throws(() => worker.process(completedMatch({ participants: ['andrew', 'andrew'] })), /duplicates/);
  assert.equal(store.getXp('andrew'), 0);
});
