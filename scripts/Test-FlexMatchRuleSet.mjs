import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rulesetUrl = new URL('../gamelift/flexmatch/co-op-defense-ruleset.json', import.meta.url);
const ruleset = JSON.parse(await readFile(rulesetUrl, 'utf8'));

assert.equal(ruleset.name, 'arthurs-trials-co-op-defense-v1');
assert.equal(ruleset.ruleLanguageVersion, '1.0');
assert.equal(ruleset.algorithm.strategy, 'exhaustiveSearch');
assert.equal(ruleset.algorithm.expansionAgeSelection, 'oldest');
assert.equal(ruleset.algorithm.backfillPriority, 'high');
assert.deepEqual(ruleset.teams, [{ name: 'Coop', minPlayers: 2, maxPlayers: 4 }]);

const latencyRule = ruleset.rules.find((rule) => rule.name === 'regional-latency');
assert.deepEqual(latencyRule, {
  name: 'regional-latency',
  description: 'Start with a latency guardrail for every player in the ticket.',
  type: 'latency',
  maxLatency: 80,
  partyAggregation: 'max',
});
assert.deepEqual(ruleset.expansions, [{
  target: 'rules[regional-latency].maxLatency',
  steps: [
    { waitTimeSeconds: 20, value: 120 },
    { waitTimeSeconds: 45, value: 160 },
  ],
}]);

console.log('Verified: the four-player FlexMatch template has a bounded latency and expansion policy.');
