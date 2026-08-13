import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calculateCapacityPlan, renderCapacityPlan } from './Generate-GameLiftCapacityPlan.mjs';

const input = JSON.parse(await readFile(new URL('../gamelift/capacity/capacity-model.input.example.json', import.meta.url), 'utf8'));
const plan = calculateCapacityPlan(input);

assert.equal(plan.sessionsPerInstance, 1);
assert.deepEqual(plan.rows.map(({ activeSessions, bufferSessions, requiredInstances, withinConfiguredMaximum }) => ({ activeSessions, bufferSessions, requiredInstances, withinConfiguredMaximum })), [
  { activeSessions: 1, bufferSessions: 1, requiredInstances: 2, withinConfiguredMaximum: true },
  { activeSessions: 3, bufferSessions: 1, requiredInstances: 4, withinConfiguredMaximum: false },
  { activeSessions: 6, bufferSessions: 2, requiredInstances: 8, withinConfiguredMaximum: false },
]);
assert.match(renderCapacityPlan(input, plan), /planning calculation, not a load-test result/);
assert.throws(() => calculateCapacityPlan({ ...input, availableSessionBufferPercent: 101 }), /zero to 100/);

console.log('Verified: the GameLift capacity model calculates session buffers and exposes scenarios beyond the approved instance ceiling.');
