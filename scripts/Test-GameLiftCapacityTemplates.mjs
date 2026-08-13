import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../gamelift/', import.meta.url);
const [queue, scaleOut, scaleIn] = await Promise.all([
  readFile(new URL('queues/arthurs-trials-demo-queue.template.json', root), 'utf8').then(JSON.parse),
  readFile(new URL('scaling/scale-out-on-low-available-sessions.template.json', root), 'utf8').then(JSON.parse),
  readFile(new URL('scaling/scale-in-on-sustained-idle-capacity.template.json', root), 'utf8').then(JSON.parse),
]);

assert.equal(queue.Name, 'arthurs-trials-demo-queue');
assert.equal(queue.TimeoutInSeconds, 120);
assert.equal(queue.Destinations[0].DestinationArn, 'REPLACE_WITH_GAME_LIFT_ALIAS_ARN');
assert.deepEqual(queue.PriorityConfiguration.PriorityOrder, ['LATENCY', 'COST', 'DESTINATION', 'LOCATION']);
assert.deepEqual(queue.PlayerLatencyPolicies, [
  { MaximumIndividualPlayerLatencyMilliseconds: 80, PolicyDurationSeconds: 20 },
  { MaximumIndividualPlayerLatencyMilliseconds: 120, PolicyDurationSeconds: 25 },
  { MaximumIndividualPlayerLatencyMilliseconds: 160, PolicyDurationSeconds: 75 },
]);

for (const policy of [scaleOut, scaleIn]) {
  assert.equal(policy.FleetId, 'REPLACE_WITH_MANAGED_CONTAINER_FLEET_ID');
  assert.equal(policy.PolicyType, 'RuleBased');
  assert.equal(policy.MetricName, 'PercentAvailableGameSessions');
  assert.equal(policy.ScalingAdjustmentType, 'ChangeInCapacity');
}
assert.equal(scaleOut.ComparisonOperator, 'LessThanOrEqualToThreshold');
assert.equal(scaleOut.Threshold, 25);
assert.equal(scaleOut.EvaluationPeriods, 3);
assert.equal(scaleOut.ScalingAdjustment, 1);
assert.equal(scaleIn.ComparisonOperator, 'GreaterThanOrEqualToThreshold');
assert.equal(scaleIn.Threshold, 60);
assert.equal(scaleIn.EvaluationPeriods, 15);
assert.equal(scaleIn.ScalingAdjustment, -1);

console.log('Verified: GameLift queue and scaling templates encode bounded latency, capacity buffer, and conservative scale-in policy.');
