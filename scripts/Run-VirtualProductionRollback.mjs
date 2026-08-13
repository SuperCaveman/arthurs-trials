import { resolve } from 'node:path';
import { runRollbackWorkflow } from '../virtual-production/src/recovery-workflow.mjs';

const args = process.argv.slice(2);
const valueFor = (flag) => args[args.indexOf(flag) + 1];
const currentManifestPath = valueFor('--current');
const recoveryManifestPath = valueFor('--recovery');
const outputPath = valueFor('--output');
if (!currentManifestPath || !recoveryManifestPath || !outputPath) throw new Error('Usage: node scripts/Run-VirtualProductionRollback.mjs --current <v-current-manifest> --recovery <v-prior-manifest> --output <path>');
const workflow = await runRollbackWorkflow({ currentManifestPath: resolve(currentManifestPath), recoveryManifestPath: resolve(recoveryManifestPath), outputPath: resolve(outputPath) });
process.stdout.write(`${JSON.stringify({ event: 'virtual_production_rollback_complete', from: workflow.currentVersion, to: workflow.rollbackVersion, retainedVersions: workflow.recovery.preservedVersions.length, cloudResourcesCreated: false }, null, 2)}\n`);
