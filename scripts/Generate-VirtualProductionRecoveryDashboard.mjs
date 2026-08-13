import { resolve } from 'node:path';
import { createRecoveryDashboard } from '../virtual-production/src/recovery-dashboard.mjs';

const args = process.argv.slice(2);
const valueFor = (flag) => args[args.indexOf(flag) + 1];
const workflowPath = valueFor('--workflow');
const rollbackPath = valueFor('--rollback');
const outputPath = valueFor('--output');
if (!workflowPath || !rollbackPath || !outputPath) throw new Error('Usage: node scripts/Generate-VirtualProductionRecoveryDashboard.mjs --workflow <workflow-json> --rollback <rollback-json> --output <html>');
const { rollback } = await createRecoveryDashboard({ workflowPath: resolve(workflowPath), rollbackPath: resolve(rollbackPath), outputPath: resolve(outputPath) });
process.stdout.write(`${JSON.stringify({ event: 'virtual_production_recovery_dashboard_generated', from: rollback.currentVersion, to: rollback.recovery.finalStageVersion, cloudResourcesCreated: false })}\n`);
