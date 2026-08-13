import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendAuditEvents } from '../virtual-production/src/audit-ledger.mjs';

const root = await mkdtemp(join(tmpdir(), 'arthurs-trials-vp-audit-'));
try {
  const ledgerPath = join(root, 'audit.jsonl');
  const approval = { event: 'stage_asset_approved', versionId: 'Castle_Set_v12', stageTarget: 'local-stage-workstation-demo', approval: { status: 'Approved for Stage' } };
  const rollback = { event: 'stage_asset_rollback', currentVersion: 'Castle_Set_v12', stageTarget: 'local-stage-workstation-demo', recovery: { finalStageVersion: 'Castle_Set_v11' } };
  const first = await appendAuditEvents({ ledgerPath, events: [approval, rollback] });
  assert.deepEqual(first.results.map((result) => result.disposition), ['APPENDED', 'APPENDED']);
  const replay = await appendAuditEvents({ ledgerPath, events: [approval, rollback] });
  assert.deepEqual(replay.results.map((result) => result.disposition), ['DUPLICATE', 'DUPLICATE']);
  const ledger = (await readFile(ledgerPath, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(ledger.length, 2);
  assert.ok(ledger.every((entry) => /^[a-f0-9]{64}$/.test(entry.eventId)));
  const approvalPath = join(root, 'approval.json');
  const rollbackPath = join(root, 'rollback.json');
  const cliLedgerPath = join(root, 'cli-audit.jsonl');
  await writeFile(approvalPath, JSON.stringify(approval));
  await writeFile(rollbackPath, JSON.stringify(rollback));
  const { stdout } = await promisify(execFile)(process.execPath, ['./scripts/Run-VirtualProductionAuditLedger.mjs', '--ledger', cliLedgerPath, '--event', approvalPath, '--event', rollbackPath], { cwd: process.cwd() });
  assert.match(stdout, /"appended":2/);
  console.log('Verified: the local VP audit ledger persists approval/recovery status exactly once and safely rejects duplicates.');
} finally { await rm(root, { recursive: true, force: true }); }
