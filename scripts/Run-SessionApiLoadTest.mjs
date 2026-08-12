import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createFakeGameLiftAdapter, createSessionApi } from '../api/src/server.mjs';

const requestCount = Number(process.env.REQUESTS ?? 40);
const concurrency = Number(process.env.CONCURRENCY ?? 10);

if (!Number.isInteger(requestCount) || requestCount < 1 || requestCount > 500) {
  throw new Error('REQUESTS must be an integer from 1 through 500.');
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 50) {
  throw new Error('CONCURRENCY must be an integer from 1 through 50.');
}

const api = createSessionApi({
  adapter: createFakeGameLiftAdapter(),
  logger: { info() {}, error() {} },
});

api.listen(0, '127.0.0.1');
await once(api, 'listening');
const { port } = api.address();
const latencies = [];
let nextRequest = 0;
let failures = 0;

function percentile(values, requestedPercentile) {
  const ordered = [...values].sort((left, right) => left - right);
  const index = Math.min(ordered.length - 1, Math.ceil((requestedPercentile / 100) * ordered.length) - 1);
  return Number(ordered[index].toFixed(2));
}

async function makeRequest(index) {
  const playerId = `loadplayer${String(index).padStart(3, '0')}`;
  const startedAt = performance.now();
  const response = await fetch(`http://127.0.0.1:${port}/v1/matches`, {
    method: 'POST',
    headers: {
      authorization: `Bearer local-dev-${playerId}`,
      'idempotency-key': randomUUID(),
      'content-type': 'application/json',
    },
    body: JSON.stringify({ mode: 'co-op-defense', region: 'us-east-1', party: [playerId] }),
  });
  latencies.push(performance.now() - startedAt);
  if (response.status !== 201) failures += 1;
}

async function runWorker() {
  while (nextRequest < requestCount) {
    const currentRequest = nextRequest;
    nextRequest += 1;
    await makeRequest(currentRequest);
  }
}

try {
  await Promise.all(Array.from({ length: Math.min(concurrency, requestCount) }, runWorker));
  const summary = {
    scenario: 'local-session-api-fake-adapter',
    requests: requestCount,
    concurrency,
    successfulRequests: requestCount - failures,
    failedRequests: failures,
    latencyMs: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      max: Number(Math.max(...latencies).toFixed(2)),
    },
    scope: 'Local HTTP/API overhead only; it does not measure GameLift placement, Unreal server tick time, or player capacity.',
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (failures > 0) process.exitCode = 1;
} finally {
  api.close();
  await once(api, 'close');
}
