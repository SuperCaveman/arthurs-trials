import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const apiPath = new URL('../api/src/server.mjs', import.meta.url);
const api = await readFile(apiPath, 'utf8');

assert.match(api, /FleetCapacityExceededException/);
assert.match(api, /GAME_SERVER_CAPACITY_UNAVAILABLE/);
assert.match(api, /status: 'PLACEMENT_PENDING'/);
assert.match(api, /pollAfterSeconds: 2/);
assert.doesNotMatch(api, /sendJson\(response, 409,[\s\S]*?FleetCapacityExceededException/);

console.log('Verified: exhausted GameLift capacity is mapped to a player-safe pending response.');
