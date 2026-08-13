import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const outputDirectory = await mkdtemp(join(tmpdir(), 'arthurs-trials-placement-simulation-'));

try {
  const { stdout } = await execute(process.execPath, ['scripts/Run-PlacementLoadSimulation.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, SIM_REQUESTS: '8', SIM_CONCURRENCY: '4', SIM_ADMISSION_DELAY_MS: '1', SIM_COMPLETION_DELAY_MS: '1', SIM_OUT_DIR: outputDirectory },
  });
  const summary = JSON.parse(stdout);
  const persistedSummary = JSON.parse(await readFile(join(outputDirectory, 'placement-simulation-summary.json'), 'utf8'));
  const csv = await readFile(join(outputDirectory, 'placement-simulation-results.csv'), 'utf8');
  const chart = await readFile(join(outputDirectory, 'placement-simulation-chart.svg'), 'utf8');
  assert.equal(summary.requests, 8);
  assert.equal(summary.concurrency, 4);
  assert.equal(summary.upperConcurrencyCap, 20);
  assert.equal(summary.successfulRequests, 8);
  assert.equal(summary.failedRequests, 0);
  assert.deepEqual(persistedSummary.artifacts, ['placement-simulation-results.csv', 'placement-simulation-summary.json', 'placement-simulation-chart.svg']);
  assert.match(summary.scope, /does not call AWS/i);
  assert.equal(csv.trim().split('\n').length, 9);
  assert.match(chart, /Synthetic local fake-adapter result/);
  assert.match(chart, /not GameLift placement/i);
  console.log('Verified: the bounded local placement simulator creates CSV, JSON, and explicitly scoped chart evidence without AWS calls.');
} finally {
  await rm(outputDirectory, { recursive: true, force: true });
}
