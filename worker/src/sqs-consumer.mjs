import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { fileURLToPath } from 'node:url';
import { createPostgresPool, createPostgresResultsStore } from './postgres-results-store.mjs';
import { createResultsWorker } from './worker.mjs';

export async function processOneSqsMessage({ sqs, queueUrl, worker, logger = console }) {
  const received = await sqs.send(new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 20,
    VisibilityTimeout: 60,
  }));
  const message = received.Messages?.[0];
  if (!message) return { disposition: 'EMPTY' };

  try {
    const result = await worker.process(JSON.parse(message.Body));
    await sqs.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: message.ReceiptHandle }));
    logger.info?.({ event: 'match_result_sqs_processed', disposition: result.disposition });
    return result;
  } catch (error) {
    // Do not delete malformed or transiently failed messages. SQS will retry
    // them and send repeated failures to the configured DLQ.
    logger.error?.({ event: 'match_result_sqs_retry', message: error.message });
    return { disposition: 'RETRY' };
  }
}

async function connectionStringFromSecret({ secretArn, region }) {
  const secrets = new SecretsManagerClient({ region });
  const result = await secrets.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const secret = JSON.parse(result.SecretString ?? '{}');
  if (!secret.host || !secret.username || !secret.password || !secret.dbname) {
    throw new Error('RDS secret is missing connection fields.');
  }
  return `postgresql://${encodeURIComponent(secret.username)}:${encodeURIComponent(secret.password)}@${secret.host}:${secret.port ?? 5432}/${secret.dbname}?sslmode=require`;
}

async function main() {
  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
  const queueUrl = process.env.RESULTS_QUEUE_URL;
  const secretArn = process.env.RESULTS_DATABASE_SECRET_ARN;
  if (!region || !queueUrl || !secretArn) {
    throw new Error('AWS_REGION, RESULTS_QUEUE_URL, and RESULTS_DATABASE_SECRET_ARN are required.');
  }

  const connectionString = await connectionStringFromSecret({ secretArn, region });
  const pool = createPostgresPool({ connectionString });
  const worker = createResultsWorker({ store: createPostgresResultsStore({ pool }) });
  const sqs = new SQSClient({ region });
  let stopping = false;
  process.on('SIGTERM', () => { stopping = true; });
  process.on('SIGINT', () => { stopping = true; });

  try {
    while (!stopping) await processOneSqsMessage({ sqs, queueUrl, worker });
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ event: 'results_worker_startup_failed', message: error.message })}\n`);
    process.exitCode = 1;
  });
}
