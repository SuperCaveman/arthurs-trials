import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [dockerfile, api] = await Promise.all([
  readFile(new URL('../api/Dockerfile', import.meta.url), 'utf8'),
  readFile(new URL('../api/src/server.mjs', import.meta.url), 'utf8'),
]);

assert.match(dockerfile, /^FROM node:22-alpine/m);
assert.match(dockerfile, /COPY package-lock\.json \.\//);
assert.match(dockerfile, /RUN npm ci --omit=dev/);
assert.match(dockerfile, /^USER node$/m);
assert.match(api, /from '@aws-sdk\/client-gamelift'/);
assert.match(api, /new GameLiftClient\(\{ region \}\)/);
assert.match(api, /CreateGameSessionCommand/);
assert.match(api, /StartGameSessionPlacementCommand/);
assert.doesNotMatch(api, /execFile/);

console.log('Verified: the session API container has a locked production install and uses the AWS SDK for GameLift instead of an embedded CLI.');
