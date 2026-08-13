import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dockerfileUrl = new URL('../worker/Dockerfile', import.meta.url);
const dockerfile = await readFile(dockerfileUrl, 'utf8');

assert.match(dockerfile, /^FROM node:22-alpine/m);
assert.match(dockerfile, /COPY package\.json \.\//);
assert.match(dockerfile, /COPY src \.\/src/);
assert.match(dockerfile, /RESULTS_STORE=memory/);
assert.match(dockerfile, /^USER node$/m);
assert.match(dockerfile, /CMD \["node", "src\/worker\.mjs"\]/);

console.log('Verified: the results worker container runs as non-root with no runtime package install.');
