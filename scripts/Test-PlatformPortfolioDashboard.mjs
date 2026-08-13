import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = await mkdtemp(join(tmpdir(), 'arthurs-trials-platform-dashboard-'));
try {
  const output = join(root, 'platform.html');
  const { stdout } = await promisify(execFile)(process.execPath, ['./scripts/Generate-PlatformPortfolioDashboard.mjs', '--output', output], { cwd: process.cwd() });
  assert.match(stdout, /cloudResourcesCreated":false/);
  const html = await readFile(output, 'utf8');
  assert.match(html, /Unreal Engine Cloud Platform/);
  assert.match(html, /GameLift Servers Anywhere/);
  assert.match(html, /Castle_Set_v12/);
  assert.match(html, /No managed AWS resources deployed/);
  assert.match(html, /unreal-cloud-platform-architecture\.svg/);
  assert.doesNotMatch(html, /accessKey|secretAccessKey|arn:aws:iam/i);
  console.log('Verified: the platform portfolio dashboard presents local proof and default-off boundaries without credentials or deployment claims.');
} finally { await rm(root, { recursive: true, force: true }); }
