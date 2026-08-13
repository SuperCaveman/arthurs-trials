import { resolve } from 'node:path';
import { runAssetWorkflow } from '../virtual-production/src/asset-pipeline.mjs';

const values = process.argv.slice(2);
const valueFor = (flag) => values[values.indexOf(flag) + 1];
const manifestPath = valueFor('--manifest');
const outputPath = valueFor('--output');
const approvedBy = valueFor('--approved-by') ?? 'portfolio-operator';
if (!manifestPath || !outputPath) throw new Error('Usage: node scripts/Run-VirtualProductionAssetFlow.mjs --manifest <path> --output <path> [--approved-by <safe-label>]');

const workflow = await runAssetWorkflow({ manifestPath: resolve(manifestPath), outputPath: resolve(outputPath), approvedBy });
process.stdout.write(`${JSON.stringify({ event: 'virtual_production_asset_workflow_complete', versionId: workflow.versionId, status: workflow.currentStatus, mode: workflow.mode, cloudResourcesCreated: false }, null, 2)}\n`);
