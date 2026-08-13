import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../docs/assets/arthurs-trials-architecture.svg', import.meta.url), 'utf8');
const platformSvg = await readFile(new URL('../docs/assets/unreal-cloud-platform-architecture.svg', import.meta.url), 'utf8');

assert.match(svg, /<svg[^>]+viewBox="0 0 1600 1080"/);
assert.match(svg, /VERIFIED LOCALLY/);
assert.match(svg, /DEFAULT-OFF DESIGN/);
assert.match(svg, /GameLift Servers Anywhere/);
assert.match(svg, /ECS\/Fargate session API/);
assert.match(svg, /Latency-aware queue/);
assert.match(svg, /SQS \+ DLQ/);
assert.match(svg, /Private RDS/);
assert.match(svg, /No client AWS access/);
assert.match(platformSvg, /Unreal Engine Cloud Platform on AWS/);
assert.match(platformSvg, /Multiplayer \/ GameLift Servers Anywhere/);
assert.match(platformSvg, /Virtual production \/ local stage workflow/);
assert.match(platformSvg, /S3 → EventBridge → Step Functions/);
assert.match(platformSvg, /Read-only stage delivery/);
assert.match(platformSvg, /No managed resources deployed/);

console.log('Verified: architecture SVGs show both gaming and virtual-production local proofs plus the default-off shared platform boundary.');
