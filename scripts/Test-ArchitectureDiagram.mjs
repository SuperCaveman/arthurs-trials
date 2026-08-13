import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../docs/assets/arthurs-trials-architecture.svg', import.meta.url), 'utf8');

assert.match(svg, /<svg[^>]+viewBox="0 0 1600 1080"/);
assert.match(svg, /VERIFIED LOCALLY/);
assert.match(svg, /DEFAULT-OFF DESIGN/);
assert.match(svg, /GameLift Servers Anywhere/);
assert.match(svg, /ECS\/Fargate session API/);
assert.match(svg, /Latency-aware queue/);
assert.match(svg, /SQS \+ DLQ/);
assert.match(svg, /Private RDS/);
assert.match(svg, /No client AWS access/);

console.log('Verified: architecture SVG distinguishes the local proof from default-off managed components and includes the platform security boundary.');
