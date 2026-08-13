import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFileResultsStore, createInMemoryResultsStore, createResultsWorker } from '../src/worker.mjs';

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

test('grants match XP once and reports a duplicate safely', async () => {
  const store = createInMemoryResultsStore();
  const worker = createResultsWorker({ store, logger: { info() {} } });
  const event = completedMatch();

  assert.equal((await worker.process(event)).disposition, 'PROCESSED');
  assert.equal((await worker.process(event)).disposition, 'DUPLICATE');
  assert.equal(await store.getXp('andrew'), 125);
  assert.equal(await store.getXp('arthur'), 125);
});

test('rejects malformed or unsupported events before modifying rewards', async () => {
  const store = createInMemoryResultsStore();
  const worker = createResultsWorker({ store, logger: { info() {} } });

  await assert.rejects(worker.process(completedMatch({ eventType: 'match.started' })), /match.completed/);
  await assert.rejects(worker.process(completedMatch({ participants: ['andrew', 'andrew'] })), /duplicates/);
  assert.equal(await store.getXp('andrew'), 0);
});

test('persists exactly-once rewards across a worker restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'arthurs-trials-results-store-'));
  const storePath = join(directory, 'results.json');
  const event = completedMatch();

  const firstStore = createFileResultsStore({ path: storePath });
  const firstWorker = createResultsWorker({ store: firstStore, logger: { info() {} } });
  assert.equal((await firstWorker.process(event)).disposition, 'PROCESSED');
  assert.equal(await firstStore.getXp('andrew'), 125);

  const secondStore = createFileResultsStore({ path: storePath });
  const secondWorker = createResultsWorker({ store: secondStore, logger: { info() {} } });
  assert.equal((await secondWorker.process(event)).disposition, 'DUPLICATE');
  assert.equal(await secondStore.getXp('andrew'), 125);
  assert.equal(await secondStore.getXp('arthur'), 125);
});
