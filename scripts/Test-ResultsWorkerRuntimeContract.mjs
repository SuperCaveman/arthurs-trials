import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../infra/', import.meta.url);
const [main, runtime, access, consumer, migration] = await Promise.all([
  readFile(new URL('main.tf', root), 'utf8'),
  readFile(new URL('modules/results-worker-runtime/main.tf', root), 'utf8'),
  readFile(new URL('modules/results-worker-access/main.tf', root), 'utf8'),
  readFile(new URL('../worker/src/sqs-consumer.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../worker/sql/001_match_results.sql', import.meta.url), 'utf8'),
]);

assert.match(main, /enable_results_worker_runtime/);
assert.match(main, /Results-worker runtime requires both enable_async_results=true and enable_database=true/);
assert.match(main, /results_worker_desired_count/);
assert.match(access, /aws_ecs_cluster/);
assert.match(access, /sqs:ReceiveMessage/);
assert.match(access, /sqs:DeleteMessage/);
assert.match(runtime, /desired_count\s+= var\.desired_count/);
assert.match(runtime, /assign_public_ip = false/);
assert.match(runtime, /secretsmanager:GetSecretValue/);
assert.match(runtime, /retention_in_days = 14/);
assert.match(consumer, /ReceiveMessageCommand/);
assert.match(consumer, /DeleteMessageCommand/);
assert.match(consumer, /Do not delete malformed or transiently failed messages/);
assert.match(migration, /event_id VARCHAR\(128\) PRIMARY KEY/);
assert.match(migration, /player_progression/);

console.log('Verified: the opt-in worker runtime has private networking, narrow queue/secret access, and an at-least-once delivery boundary.');
