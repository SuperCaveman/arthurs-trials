import assert from 'node:assert/strict';
import test from 'node:test';
import { processOneSqsMessage } from '../src/sqs-consumer.mjs';

test('deletes an SQS message only after the idempotent worker succeeds', async () => {
  const commands = [];
  const sqs = {
    async send(command) {
      commands.push(command.constructor.name);
      return commands.length === 1
        ? { Messages: [{ Body: '{"eventType":"match.completed"}', ReceiptHandle: 'opaque' }] }
        : {};
    },
  };
  const worker = { async process() { return { disposition: 'PROCESSED' }; } };

  const result = await processOneSqsMessage({ sqs, queueUrl: 'https://example.invalid/queue', worker, logger: { info() {} } });
  assert.equal(result.disposition, 'PROCESSED');
  assert.deepEqual(commands, ['ReceiveMessageCommand', 'DeleteMessageCommand']);
});

test('leaves a rejected SQS message for retry and DLQ handling', async () => {
  const commands = [];
  const sqs = {
    async send(command) {
      commands.push(command.constructor.name);
      return { Messages: [{ Body: 'not-json', ReceiptHandle: 'opaque' }] };
    },
  };
  const worker = { async process() { throw new Error('invalid result'); } };

  const result = await processOneSqsMessage({ sqs, queueUrl: 'https://example.invalid/queue', worker, logger: { error() {} } });
  assert.equal(result.disposition, 'RETRY');
  assert.deepEqual(commands, ['ReceiveMessageCommand']);
});
