import assert from 'node:assert/strict';
import test from 'node:test';
import { createPostgresResultsStore } from '../src/postgres-results-store.mjs';

const event = {
  eventId: '17ea8ce7-6f3f-4b2a-9c93-5c3ed89f4691',
  matchId: 'mrq_17ea8ce7-6f3f-4b2a-9c93-5c3ed89f4691',
  participants: ['andrew', 'arthur'],
  xpAward: 125,
  completedAt: '2026-08-13T15:00:00.000Z',
};

test('writes receipt and all player rewards in one PostgreSQL transaction', async () => {
  const statements = [];
  const client = {
    async query(sql) {
      statements.push(sql);
      return sql.includes('match_result_receipts') ? { rowCount: 1 } : { rowCount: 1 };
    },
    release() {},
  };
  const store = createPostgresResultsStore({ pool: { async connect() { return client; } } });

  assert.equal(await store.applyOnce(event), true);
  assert.equal(statements[0], 'BEGIN');
  assert.match(statements[1], /ON CONFLICT \(event_id\) DO NOTHING/);
  assert.equal(statements.filter((sql) => sql.includes('player_progression')).length, 2);
  assert.equal(statements.at(-1), 'COMMIT');
});

test('rolls back a duplicate receipt without awarding XP again', async () => {
  const statements = [];
  const client = {
    async query(sql) {
      statements.push(sql);
      return sql.includes('match_result_receipts') ? { rowCount: 0 } : { rowCount: 1 };
    },
    release() {},
  };
  const store = createPostgresResultsStore({ pool: { async connect() { return client; } } });

  assert.equal(await store.applyOnce(event), false);
  assert.deepEqual(statements, [
    'BEGIN',
    statements[1],
    'ROLLBACK',
  ]);
});
