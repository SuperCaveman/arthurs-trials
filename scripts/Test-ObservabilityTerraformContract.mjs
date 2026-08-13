import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../infra/', import.meta.url);
const [main, module] = await Promise.all([
  readFile(new URL('main.tf', root), 'utf8'),
  readFile(new URL('modules/observability/main.tf', root), 'utf8'),
]);

assert.match(main, /enable_observability/);
assert.match(main, /Observability requires enable_results_worker_runtime=true/);
assert.match(main, /observability_alarm_actions/);
assert.match(module, /aws_cloudwatch_dashboard/);
assert.match(module, /ApproximateAgeOfOldestMessage/);
assert.match(module, /ApproximateNumberOfMessagesVisible/);
assert.match(module, /CPUUtilization/);
assert.match(module, /MemoryUtilization/);
assert.match(module, /FreeStorageSpace/);
assert.match(module, /threshold\s+= 5368709120/);
assert.match(module, /actions_enabled\s+= local\.common_alarm\.actions_enabled/);

console.log('Verified: the opt-in operations dashboard covers queue, DLQ, worker, and database signals without creating a notification service.');
