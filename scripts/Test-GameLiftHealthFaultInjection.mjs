import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const gameModePath = new URL('../game/ArthursTrials/Source/ArthursTrials/ArthursTrialsGameMode.cpp', import.meta.url);
const launcherPath = new URL('./Start-GameLiftAnywhereLocal.ps1', import.meta.url);
const gameMode = await readFile(gameModePath, 'utf8');
const launcher = await readFile(launcherPath, 'utf8');

assert.match(gameMode, /GameLiftFailHealthChecks=/);
assert.match(gameMode, /RemainingForcedHealthCheckFailures = FMath::Max\(0, RemainingForcedHealthCheckFailures\)/);
assert.match(gameMode, /Fault injection: deliberately failed a GameLift health check/);
assert.match(gameMode, /--RemainingForcedHealthCheckFailures/);
assert.match(gameMode, /return false;/);
assert.match(launcher, /\[int\]\$FailHealthChecks = 0/);
assert.match(launcher, /-GameLiftFailHealthChecks=\$FailHealthChecks/);

console.log('Verified: GameLift health fault injection is opt-in, bounded, and wired through the Anywhere launcher.');
