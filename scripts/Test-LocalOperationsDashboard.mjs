import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectOperationsEvidence, renderOperationsDashboard } from './Generate-LocalOperationsDashboard.mjs';

const root = await mkdtemp(join(tmpdir(), 'arthurs-trials-dashboard-'));
const serverLogPath = join(root, 'ArthursTrials.log');
const outboxDirectory = join(root, 'outbox');
await mkdir(join(outboxDirectory, 'processed'), { recursive: true });
await writeFile(serverLogPath, [
  '[2026.08.13-03.05.40:375][  0] LogArthursTrialsGameServer: GameLift ProcessReady succeeded on port 7778.',
  '[2026.08.13-03.05.48:307][257] LogArthursTrialsGameServer: GameLift requested session activation: arn:aws:gamelift:us-east-1:123456789012:gamesession/fleet-secret/gsess-secret',
  '[2026.08.13-03.06.08:707][872] LogArthursTrialsGameServer: Authoritative match-completion event published to the local outbox for 1 participant(s).',
  '[2026.08.13-03.06.48:276][ 64] LogArthursTrialsGameServer: GameLift requested process termination.',
  '[2026.08.13-03.06.48:861][ 80] LogExit: Exiting.',
].join('\n'));
await writeFile(join(outboxDirectory, 'processed', 'event.json'), JSON.stringify({ eventType: 'match.completed', participants: ['andrew'], xpAward: 125, completedAt: '2026-08-13T03:06:08.000Z' }));

const evidence = await collectOperationsEvidence({ serverLogPath, outboxDirectory });
const html = renderOperationsDashboard(evidence);
assert.equal(evidence.events.length, 5);
assert.equal(evidence.processedEvents.length, 1);
assert.match(html, /1 player\(s\) · 125 XP · worker processed/);
assert.doesNotMatch(html, /123456789012|fleet-secret|gsess-secret/);
assert.doesNotMatch(html, /authToken|PlayerSessionId/);
console.log('Verified: local operations dashboard derives safe lifecycle and worker evidence without exposing raw GameLift identifiers.');
