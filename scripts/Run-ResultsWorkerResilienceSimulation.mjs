import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { processOneSqsMessage } from '../worker/src/sqs-consumer.mjs';
import { createInMemoryResultsStore, createResultsWorker } from '../worker/src/worker.mjs';

const outputDirectory = process.env.RESILIENCE_SIM_OUT_DIR ? resolve(process.env.RESILIENCE_SIM_OUT_DIR) : null;
const maximumReceives = 3;

function completedEvent(eventId, participant) {
  return {
    eventType: 'match.completed',
    eventId,
    matchId: 'mrq_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    participants: [participant],
    xpAward: 125,
    completedAt: '2026-08-13T00:00:00.000Z',
  };
}

function createLocalSqsSimulation(messages, maxReceives = maximumReceives) {
  const pending = messages.map((body, index) => ({ id: `message-${index + 1}`, body, receives: 0 }));
  const deadLetters = [];
  const commandLog = [];
  return {
    pending,
    deadLetters,
    commandLog,
    async send(command) {
      commandLog.push(command.constructor.name);
      if (command.constructor.name === 'ReceiveMessageCommand') {
        const message = pending[0];
        if (!message) return { Messages: [] };
        if (message.receives >= maxReceives) {
          deadLetters.push(pending.shift());
          return { Messages: [] };
        }
        message.receives += 1;
        return { Messages: [{ Body: message.body, ReceiptHandle: message.id }] };
      }
      if (command.constructor.name === 'DeleteMessageCommand') {
        const index = pending.findIndex((message) => message.id === command.input.ReceiptHandle);
        if (index >= 0) pending.splice(index, 1);
        return {};
      }
      throw new Error(`Unexpected local queue command: ${command.constructor.name}`);
    },
  };
}

const transientEvent = completedEvent('11111111-2222-3333-4444-555555555555', 'andrew');
const queue = createLocalSqsSimulation([JSON.stringify(transientEvent), '{not-json']);
const store = createInMemoryResultsStore();
const baseWorker = createResultsWorker({ store, logger: { info() {} } });
let transientFailureRemaining = true;
const worker = {
  async process(event) {
    if (event.eventId === transientEvent.eventId && transientFailureRemaining) {
      transientFailureRemaining = false;
      throw new Error('Controlled transient datastore failure.');
    }
    return baseWorker.process(event);
  },
};
const workerEvents = [];
const logger = {
  info(record) { workerEvents.push(record.event); },
  error(record) { workerEvents.push(record.event); },
};
const outcomes = [];

while (queue.pending.length > 0) {
  outcomes.push((await processOneSqsMessage({
    sqs: queue,
    queueUrl: 'https://local.invalid/arthurs-trials-results',
    worker,
    logger,
  })).disposition);
}

const summary = {
  scenario: 'local-sqs-semantics-results-worker-resilience',
  maximumReceives,
  outcomes,
  transientFailureRecovered: outcomes.slice(0, 2).join(' -> ') === 'RETRY -> PROCESSED',
  poisonMessageMovedToDlq: queue.deadLetters.length === 1 && outcomes.filter((outcome) => outcome === 'RETRY').length === maximumReceives + 1,
  workerEvents,
  awardedXp: await store.getXp('andrew'),
  dlqMessageCount: queue.deadLetters.length,
  scope: 'Local in-memory SQS-semantics simulation. It exercises the worker retry/delete path but does not call AWS or prove a deployed SQS/DLQ service.',
};

if (!summary.transientFailureRecovered || !summary.poisonMessageMovedToDlq || summary.awardedXp !== 125) {
  throw new Error('The local resilience simulation did not meet its expected outcomes.');
}

if (outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(join(outputDirectory, 'results-worker-resilience-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
}

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
