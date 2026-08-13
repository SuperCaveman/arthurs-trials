import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createSessionApi } from '../api/src/server.mjs';

const requestCount = Number(process.env.SIM_REQUESTS ?? 20);
const concurrency = Number(process.env.SIM_CONCURRENCY ?? 4);
const admissionDelayMilliseconds = Number(process.env.SIM_ADMISSION_DELAY_MS ?? 15);
const completionDelayMilliseconds = Number(process.env.SIM_COMPLETION_DELAY_MS ?? 30);
const dryRun = /^(1|true|yes)$/i.test(process.env.SIM_DRY_RUN ?? 'false');
const outputDirectory = process.env.SIM_OUT_DIR ? resolve(process.env.SIM_OUT_DIR) : null;
const maximumRequests = 200;
const maximumConcurrency = 20;

function requireInteger(name, value, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} through ${maximum}.`);
  }
}

requireInteger('SIM_REQUESTS', requestCount, 1, maximumRequests);
requireInteger('SIM_CONCURRENCY', concurrency, 1, maximumConcurrency);
requireInteger('SIM_ADMISSION_DELAY_MS', admissionDelayMilliseconds, 0, 5_000);
requireInteger('SIM_COMPLETION_DELAY_MS', completionDelayMilliseconds, 0, 5_000);

const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function percentile(values, requestedPercentile) {
  const ordered = [...values].sort((left, right) => left - right);
  const index = Math.min(ordered.length - 1, Math.ceil((requestedPercentile / 100) * ordered.length) - 1);
  return Number(ordered[index].toFixed(2));
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function renderChart(summary) {
  const metrics = [
    ['p50 placement', summary.placementLatencyMs.p50],
    ['p95 placement', summary.placementLatencyMs.p95],
    ['max placement', summary.placementLatencyMs.max],
    ['admission', summary.admissionLatencyMs.p95],
    ['completion', summary.completionLatencyMs.p95],
  ];
  const width = 900;
  const height = 430;
  const chartLeft = 230;
  const chartWidth = 600;
  const barHeight = 38;
  const gap = 18;
  const maximum = Math.max(1, ...metrics.map(([, value]) => value));
  const bars = metrics.map(([label, value], index) => {
    const y = 120 + index * (barHeight + gap);
    const barWidth = Math.max(2, Math.round((value / maximum) * chartWidth));
    return `<text x="${chartLeft - 18}" y="${y + 25}" text-anchor="end" class="label">${label}</text>\n`
      + `<rect x="${chartLeft}" y="${y}" width="${barWidth}" height="${barHeight}" rx="5" class="bar"/>\n`
      + `<text x="${chartLeft + barWidth + 10}" y="${y + 25}" class="value">${value} ms</text>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">Arthur's Trials local placement simulation</title>
  <desc id="description">Synthetic local session API placement measurements. This chart is not a GameLift or production load test.</desc>
  <style>
    .background { fill: #08131e; } .title { fill: #f1f7fb; font: 700 28px system-ui, sans-serif; }
    .subtitle { fill: #a8bdc9; font: 16px system-ui, sans-serif; } .label { fill: #d5e4ec; font: 16px system-ui, sans-serif; }
    .value { fill: #f1f7fb; font: 700 16px system-ui, sans-serif; } .bar { fill: #25b7a5; }
    .note { fill: #f3c969; font: 14px system-ui, sans-serif; }
  </style>
  <rect class="background" width="100%" height="100%" rx="18"/>
  <text x="48" y="56" class="title">Local placement simulation</text>
  <text x="48" y="84" class="subtitle">${summary.requests} synthetic requests · concurrency ${summary.concurrency} · ${summary.successfulRequests}/${summary.requests} completed</text>
  ${bars}
  <text x="48" y="395" class="note">Synthetic local fake-adapter result — not GameLift placement, Unreal tick, or cloud-capacity evidence.</text>
</svg>\n`;
}

function createSimulatedAdapter() {
  let sequence = 0;
  return {
    async createMatch({ playerId }) {
      sequence += 1;
      await sleep(admissionDelayMilliseconds);
      return {
        address: '127.0.0.1',
        port: 7778,
        playerSessionId: `psess_simulated_${sequence}_${playerId}`,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      };
    },
  };
}

async function runSyntheticRequest(index, baseUrl) {
  const playerId = `simplayer${String(index).padStart(3, '0')}`;
  const startedAt = performance.now();
  if (dryRun) {
    return { request: index + 1, status: 'DRY_RUN', placementLatencyMs: 0, admissionLatencyMs: admissionDelayMilliseconds, completionLatencyMs: completionDelayMilliseconds };
  }
  const response = await fetch(`${baseUrl}/v1/matches`, {
    method: 'POST',
    headers: { authorization: `Bearer local-dev-${playerId}`, 'idempotency-key': randomUUID(), 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'co-op-defense', region: 'us-east-1', party: [playerId] }),
  });
  const placementLatencyMs = performance.now() - startedAt;
  if (response.status !== 201) return { request: index + 1, status: `HTTP_${response.status}`, placementLatencyMs, admissionLatencyMs: 0, completionLatencyMs: 0 };
  await sleep(completionDelayMilliseconds);
  return { request: index + 1, status: 'COMPLETED', placementLatencyMs, admissionLatencyMs: admissionDelayMilliseconds, completionLatencyMs: completionDelayMilliseconds };
}

let api;
try {
  let baseUrl = 'http://127.0.0.1:0';
  if (!dryRun) {
    api = createSessionApi({ adapter: createSimulatedAdapter(), logger: { info() {}, error() {} } });
    api.listen(0, '127.0.0.1');
    await once(api, 'listening');
    baseUrl = `http://127.0.0.1:${api.address().port}`;
  }
  const results = [];
  let nextRequest = 0;
  async function worker() {
    while (nextRequest < requestCount) {
      const index = nextRequest;
      nextRequest += 1;
      results.push(await runSyntheticRequest(index, baseUrl));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, requestCount) }, worker));
  const successful = results.filter((result) => result.status === (dryRun ? 'DRY_RUN' : 'COMPLETED'));
  const placementLatencies = successful.map((result) => result.placementLatencyMs);
  const admissionLatencies = successful.map((result) => result.admissionLatencyMs);
  const completionLatencies = successful.map((result) => result.completionLatencyMs);
  const summary = {
    scenario: dryRun ? 'local-placement-simulation-dry-run' : 'local-placement-simulation-fake-adapter',
    requests: requestCount,
    concurrency,
    upperConcurrencyCap: maximumConcurrency,
    successfulRequests: successful.length,
    failedRequests: results.length - successful.length,
    placementLatencyMs: { p50: percentile(placementLatencies, 50), p95: percentile(placementLatencies, 95), max: Number(Math.max(...placementLatencies).toFixed(2)) },
    admissionLatencyMs: { p50: percentile(admissionLatencies, 50), p95: percentile(admissionLatencies, 95), max: Number(Math.max(...admissionLatencies).toFixed(2)) },
    completionLatencyMs: { p50: percentile(completionLatencies, 50), p95: percentile(completionLatencies, 95), max: Number(Math.max(...completionLatencies).toFixed(2)) },
    scope: 'Synthetic local fake-adapter simulation. It does not call AWS, start Unreal, prove GameLift placement, or measure server/player capacity.',
  };
  if (outputDirectory) {
    await mkdir(outputDirectory, { recursive: true });
    summary.artifacts = ['placement-simulation-results.csv', 'placement-simulation-summary.json', 'placement-simulation-chart.svg'];
    const header = ['request', 'status', 'placement_latency_ms', 'admission_latency_ms', 'completion_latency_ms'];
    const rows = results.sort((left, right) => left.request - right.request).map((result) => [result.request, result.status, result.placementLatencyMs.toFixed(2), result.admissionLatencyMs.toFixed(2), result.completionLatencyMs.toFixed(2)]);
    await writeFile(join(outputDirectory, 'placement-simulation-results.csv'), [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n');
    await writeFile(join(outputDirectory, 'placement-simulation-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
    await writeFile(join(outputDirectory, 'placement-simulation-chart.svg'), renderChart(summary));
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.failedRequests > 0) process.exitCode = 1;
} finally {
  if (api) {
    api.close();
    await once(api, 'close');
  }
}
