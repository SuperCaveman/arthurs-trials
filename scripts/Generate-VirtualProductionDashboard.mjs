import { resolve } from 'node:path';
import { createWorkflowDashboard } from '../virtual-production/src/workflow-dashboard.mjs';

const args = process.argv.slice(2);
const valueFor = (flag) => args[args.indexOf(flag) + 1];
const workflowPath = valueFor('--workflow');
const outputPath = valueFor('--output');
if (!workflowPath || !outputPath) throw new Error('Usage: node scripts/Generate-VirtualProductionDashboard.mjs --workflow <workflow-json> --output <html>');
const workflow = await createWorkflowDashboard({ workflowPath: resolve(workflowPath), outputPath: resolve(outputPath) });
process.stdout.write(`${JSON.stringify({ event: 'virtual_production_dashboard_generated', versionId: workflow.versionId, cloudResourcesCreated: false })}\n`);
