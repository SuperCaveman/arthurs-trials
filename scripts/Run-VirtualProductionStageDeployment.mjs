import { resolve } from 'node:path';
import { deployApprovedStageEnvironment } from '../virtual-production/src/stage-deployment.mjs';

const args = process.argv.slice(2);
const valueFor = (flag) => args[args.indexOf(flag) + 1];
const approvalPath = valueFor('--approval');
const stageStatePath = valueFor('--stage-state');
if (!approvalPath || !stageStatePath) throw new Error('Usage: node scripts/Run-VirtualProductionStageDeployment.mjs --approval <approval.json> --stage-state <current-stage.json>');
const state = await deployApprovedStageEnvironment({ approvalPath: resolve(approvalPath), stageStatePath: resolve(stageStatePath) });
process.stdout.write(`${JSON.stringify({ event: state.event, versionId: state.versionId, stageTarget: state.stageTarget, cloudResourcesCreated: false })}\n`);
