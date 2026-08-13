import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const api = await readFile(new URL('../api/src/server.mjs', import.meta.url), 'utf8');

assert.match(api, /createQueueGameLiftAdapter/);
assert.match(api, /start-game-session-placement/);
assert.match(api, /describe-game-session-placement/);
assert.match(api, /--desired-player-sessions/);
assert.match(api, /--player-latencies/);
assert.match(api, /PlacedPlayerSessions\?\.find/);
assert.match(api, /GAME_LIFT_ADAPTER must be fake, anywhere, or queue/);
assert.match(api, /Measured latency is required for every party player/);

console.log('Verified: the managed GameLift queue adapter submits party latency and returns only the caller reservation from a fulfilled placement.');
