import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../infra/', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const [main, variables, module] = await Promise.all([
  read('main.tf'),
  read('variables.tf'),
  read('modules/async-results/main.tf'),
]);

assert.match(main, /async_results_enabled\s+=\s+local\.managed_demo_enabled && var\.enable_async_results/);
assert.match(main, /module "async_results"[\s\S]*?count\s+=\s+local\.async_results_enabled \? 1 : 0/);
assert.match(variables, /variable "enable_async_results"[\s\S]*?default\s+=\s+false/);
assert.match(module, /resource "aws_sqs_queue" "dead_letter"/);
assert.match(module, /resource "aws_sqs_queue" "match_results"/);
assert.match(module, /sqs_managed_sse_enabled\s+=\s+true/g);
assert.match(module, /deadLetterTargetArn/);
assert.match(module, /maxReceiveCount\s+=\s+5/);
assert.match(module, /visibility_timeout_seconds\s+=\s+60/);

console.log('Verified: SQS/DLQ results transport is encrypted, bounded, and default-off.');
