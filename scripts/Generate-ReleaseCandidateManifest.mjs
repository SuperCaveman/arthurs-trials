import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

function parseArguments(argumentsList) {
  const outputIndex = argumentsList.indexOf('--output');
  if (outputIndex === -1 || !argumentsList[outputIndex + 1]) {
    throw new Error('Usage: node Generate-ReleaseCandidateManifest.mjs --output <path> <image> [image...]');
  }
  const images = argumentsList.slice(outputIndex + 2);
  if (images.length === 0) throw new Error('At least one local image tag is required.');
  return { output: resolve(argumentsList[outputIndex + 1]), images };
}

async function digestDockerImage(image) {
  const digest = createHash('sha256');
  const process = spawn('docker', ['save', image], { stdio: ['ignore', 'pipe', 'pipe'] });
  let errorText = '';
  process.stdout.on('data', (chunk) => digest.update(chunk));
  process.stderr.on('data', (chunk) => { errorText += chunk; });
  const exitCode = await new Promise((resolveExit) => process.on('close', resolveExit));
  if (exitCode !== 0) throw new Error(`Unable to export ${image}: ${errorText.trim()}`);
  return `sha256:${digest.digest('hex')}`;
}

const { output, images } = parseArguments(process.argv.slice(2));
const artifacts = [];
for (const image of images) artifacts.push({ image, archiveSha256: await digestDockerImage(image) });

const manifest = {
  schemaVersion: 1,
  kind: 'arthurs-trials-release-candidate',
  releaseLabel: process.env.RELEASE_LABEL ?? 'local',
  sourceRevision: process.env.SOURCE_REVISION ?? 'local-uncommitted',
  createdAt: new Date().toISOString(),
  artifacts,
  deployment: {
    performed: false,
    reason: 'This workflow builds local candidate artifacts only. It has no AWS credentials, registry login, or deployment step.',
  },
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Release evidence manifest created for ${artifacts.length} local container artifacts.`);
