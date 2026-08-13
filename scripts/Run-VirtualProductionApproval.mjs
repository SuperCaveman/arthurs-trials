import { resolve } from 'node:path';
import { runStageApproval } from '../virtual-production/src/approval-workflow.mjs';

const args = process.argv.slice(2);
const valueFor = (flag) => args[args.indexOf(flag) + 1];
const manifestPath = valueFor('--manifest');
const outputPath = valueFor('--output');
const approvedBy = valueFor('--approved-by') || 'stage-supervisor';
if (!manifestPath || !outputPath) throw new Error('Usage: node scripts/Run-VirtualProductionApproval.mjs --manifest <asset-manifest.json> --output <approval.json> [--approved-by stage-supervisor]');
const approval = await runStageApproval({ manifestPath: resolve(manifestPath), outputPath: resolve(outputPath), approvedBy });
process.stdout.write(`${JSON.stringify({ event: approval.event, versionId: approval.versionId, status: approval.approval.status, cloudResourcesCreated: false })}\n`);
