import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const templatePath = new URL('../containers/server/gamelift-game-server-container.template.json', import.meta.url);
const definition = JSON.parse(await readFile(templatePath, 'utf8'));
const ranges = definition.PortConfiguration?.ContainerPortRanges;

assert.equal(definition.ContainerName, 'arthurs-trials-server');
assert.match(definition.ImageUri, /^REPLACE_WITH_ACCOUNT_ID\.dkr\.ecr\.us-east-1\.amazonaws\.com\//);
assert.match(definition.ImageUri, /REPLACE_WITH_IMMUTABLE_TAG$/);
assert.equal(definition.ServerSdkVersion, '5.6.0');
assert.deepEqual(ranges, [{ FromPort: 7777, ToPort: 7779, Protocol: 'UDP' }]);

console.log('Verified: GameLift managed-container template is valid JSON and matches the local server contract.');
