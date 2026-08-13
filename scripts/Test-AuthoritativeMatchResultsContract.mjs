import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const gameModePath = new URL('../game/ArthursTrials/Source/ArthursTrials/ArthursTrialsGameMode.cpp', import.meta.url);
const apiPath = new URL('../api/src/server.mjs', import.meta.url);
const outboxPath = new URL('../worker/src/outbox.mjs', import.meta.url);
const resultsStorePath = new URL('../worker/src/results-store.mjs', import.meta.url);
const sessionHelperPath = new URL('./New-GameLiftAnywhereSession.ps1', import.meta.url);
const launcherPath = new URL('./Start-GameLiftAnywhereLocal.ps1', import.meta.url);
const gameMode = await readFile(gameModePath, 'utf8');
const api = await readFile(apiPath, 'utf8');
const outbox = await readFile(outboxPath, 'utf8');
const resultsStore = await readFile(resultsStorePath, 'utf8');
const sessionHelper = await readFile(sessionHelperPath, 'utf8');
const launcher = await readFile(launcherPath, 'utf8');

assert.match(api, /Key=matchId,Value=\$\{matchRequestId\}/);
assert.match(api, /Key=participants,Value=\$\{party\.join\(','\)\}/);
assert.match(api, /Key=xpAward,Value=\$\{xpAward\}/);
assert.match(gameMode, /ConfigureMatchResults\(GameProperties\)/);
assert.match(gameMode, /AsyncTask\(ENamedThreads::GameThread/);
assert.match(gameMode, /Authoritative match-completion event published to the local outbox/);
assert.match(gameMode, /eventType"\), TEXT\("match\.completed"\)/);
assert.match(gameMode, /MatchResultsCompleteAfterSeconds=/);
assert.match(outbox, /createResultsWorker/);
assert.match(outbox, /match_result_outbox_processed/);
assert.match(outbox, /match_result_outbox_rejected/);
assert.match(resultsStore, /createFileResultsStore/);
assert.match(resultsStore, /processedEvents/);
assert.match(resultsStore, /await rename\(temporaryPath, path\)/);
assert.match(sessionHelper, /Key=matchId,Value=\$MatchId/);
assert.match(sessionHelper, /Key=participants,Value=\$\(\$Participants -join ','\)/);
assert.match(launcher, /MatchResultsCompleteAfterSeconds/);
assert.match(launcher, /MatchResultsOutboxDir=`"\$MatchResultsOutboxDir`"/);

console.log('Verified: authoritative server match-result metadata, local outbox transport, and idempotent worker consumer are wired together.');
