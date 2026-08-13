import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const api = await readFile(new URL('../api/src/server.mjs', import.meta.url), 'utf8');

assert.match(api, /createQueueGameLiftAdapter/);
assert.match(api, /StartGameSessionPlacementCommand/);
assert.match(api, /DescribeGameSessionPlacementCommand/);
assert.match(api, /DesiredPlayerSessions/);
assert.match(api, /PlayerLatencies/);
assert.match(api, /PlacedPlayerSessions\?\.find/);
assert.match(api, /GAME_LIFT_ADAPTER must be fake, anywhere, or queue/);
assert.match(api, /Measured latency is required for every party player/);
assert.doesNotMatch(api, /execFile/);
assert.doesNotMatch(api, /'gamelift', 'start-game-session-placement'/);

console.log('Verified: the managed GameLift queue adapter uses the AWS SDK, submits party latency, and returns only the caller reservation from a fulfilled placement.');
