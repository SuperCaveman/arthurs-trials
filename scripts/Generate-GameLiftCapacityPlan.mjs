import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function usage() {
  return 'Usage: node Generate-GameLiftCapacityPlan.mjs --input <model.json> --output <plan.md>';
}

function option(argumentsList, name) {
  const index = argumentsList.indexOf(name);
  return index === -1 ? undefined : argumentsList[index + 1];
}

export function calculateCapacityPlan(model) {
  if (!Number.isInteger(model.playersPerSession) || model.playersPerSession < 1) throw new Error('playersPerSession must be a positive integer.');
  if (!Number.isInteger(model.sessionsPerServerProcess) || model.sessionsPerServerProcess < 1) throw new Error('sessionsPerServerProcess must be a positive integer.');
  if (!Number.isInteger(model.serverProcessesPerInstance) || model.serverProcessesPerInstance < 1) throw new Error('serverProcessesPerInstance must be a positive integer.');
  if (!Number.isInteger(model.availableSessionBufferPercent) || model.availableSessionBufferPercent < 0 || model.availableSessionBufferPercent > 100) {
    throw new Error('availableSessionBufferPercent must be an integer from zero to 100.');
  }
  if (!Array.isArray(model.scenarios) || model.scenarios.length === 0) throw new Error('At least one scenario is required.');

  const sessionsPerInstance = model.sessionsPerServerProcess * model.serverProcessesPerInstance;
  return {
    sessionsPerInstance,
    rows: model.scenarios.map((scenario) => {
      if (!Number.isInteger(scenario.concurrentPlayers) || scenario.concurrentPlayers < 1) throw new Error('scenario concurrentPlayers must be a positive integer.');
      const activeSessions = Math.ceil(scenario.concurrentPlayers / model.playersPerSession);
      const bufferSessions = Math.ceil(activeSessions * model.availableSessionBufferPercent / 100);
      const totalSessions = activeSessions + bufferSessions;
      const requiredInstances = Math.ceil(totalSessions / sessionsPerInstance);
      return {
        name: scenario.name,
        concurrentPlayers: scenario.concurrentPlayers,
        activeSessions,
        bufferSessions,
        totalSessions,
        requiredInstances,
        withinConfiguredMaximum: requiredInstances <= model.instanceCapacity.maximum,
      };
    }),
  };
}

export function renderCapacityPlan(model, plan) {
  const rows = plan.rows.map((row) => `| ${row.name} | ${row.concurrentPlayers} | ${row.activeSessions} | ${row.bufferSessions} | ${row.totalSessions} | ${row.requiredInstances} | ${row.withinConfiguredMaximum ? 'yes' : 'no'} |`).join('\n');
  return `# GameLift capacity plan\n\nGenerated from \`${model.workload}\` on ${new Date().toISOString()}.\n\n**Input status:** ${model.measurementStatus}\n\n| Scenario | Concurrent players | Active sessions | Buffer sessions | Total sessions | Instances required | Within configured max |\n| --- | ---: | ---: | ---: | ---: | ---: | --- |\n${rows}\n\n## Model inputs\n\n- Players per session: ${model.playersPerSession}\n- Sessions per server process: ${model.sessionsPerServerProcess}\n- Server processes per instance: ${model.serverProcessesPerInstance}\n- Sessions per instance: ${plan.sessionsPerInstance}\n- Available-session buffer: ${model.availableSessionBufferPercent}%\n- Configured instance range: ${model.instanceCapacity.minimum}–${model.instanceCapacity.maximum}\n- Estimated scale-out time: ${model.estimatedScaleOutSeconds} seconds\n\n## Interpretation\n\nThis is a planning calculation, not a load-test result or service-level objective. Replace the example inputs with observed Linux managed-container CPU, memory, process, and cold-start measurements before setting live GameLift capacity. Any scenario above the configured maximum is a deliberate signal to raise the approved ceiling or reduce the offered concurrency; it is not evidence that the fleet can absorb that load.\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const input = option(process.argv.slice(2), '--input');
  const output = option(process.argv.slice(2), '--output');
  if (!input || !output) throw new Error(usage());
  const model = JSON.parse(await readFile(resolve(input), 'utf8'));
  const plan = calculateCapacityPlan(model);
  const outputPath = resolve(output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, renderCapacityPlan(model, plan));
  console.log(`Generated capacity plan for ${plan.rows.length} scenarios without an AWS API call.`);
}
