# FlexMatch design: Arthur's Trials co-op defense

Status: **rule-set template validated locally; not deployed**

[`../gamelift/flexmatch/co-op-defense-ruleset.json`](../gamelift/flexmatch/co-op-defense-ruleset.json)
is the planned Amazon GameLift Servers FlexMatch configuration for the first
managed demonstration. It is a small-match rule set—two to four co-op players,
not a claim of production matchmaking throughput.

## What the rule set does

| Decision | Configuration | Why |
| --- | --- | --- |
| Match size | One `Coop` team; minimum 2, maximum 4 | A pair can start a useful co-op match instead of holding players indefinitely for a full party. Four remains the dedicated-server capacity target. |
| Initial latency limit | Every party member must be at or below 80 ms | Keeps the first placement preference player-friendly. The API must submit measured UDP-beacon latency for every player. |
| Controlled relaxation | 120 ms after 20 seconds; 160 ms after 45 seconds | Makes the wait/quality trade-off explicit and observable instead of silently broadening eligibility. |
| Party safety | `partyAggregation: max` | The least well-connected party member controls a ticket's latency eligibility. |
| Backfill | `high` priority | Reuses available slots before starting more sessions once managed hosting is intentionally enabled. |

Amazon GameLift Servers documents FlexMatch small matches as rule sets up to
40 players; it requires defined teams and supports latency rules and timed
expansions. See the [small-match schema](https://docs.aws.amazon.com/gameliftservers/latest/flexmatchguide/match-ruleset-schema.html),
[rule-set design guide](https://docs.aws.amazon.com/gameliftservers/latest/flexmatchguide/match-design-ruleset.html),
and [matchmaking request guidance](https://docs.aws.amazon.com/gameliftservers/latest/flexmatchguide/match-client-start.html).

## Planned request flow

```text
Authenticated Unreal client
  -> session API validates Cognito access token
  -> API verifies party ownership and idempotency
  -> API submits one FlexMatch ticket with measured per-player latency
  -> FlexMatch selects/creates a GameLift session
  -> API returns only address, port, and player-session ID
  -> dedicated server calls AcceptPlayerSession before admission
```

The current local Anywhere proof deliberately remains direct session creation.
It already proves the server lifecycle and player-session admission; adding a
managed queue before the control plane, data store, and cost window exist would
not be an honest scale claim.

## Scaling and operations

For the first managed demo, track ticket wait time, matched versus timed-out
tickets, each expansion step, backfill rate, and the latency distribution by
region. A production system would tune these values from real cohorts, use a
queue across appropriate fleets/locations, and evaluate regional expansion
separately. Do not infer multi-region capacity from this four-player template.

## Cost and security posture

The JSON file creates nothing and has no cost. It contains no account IDs,
fleet IDs, credentials, or player data. The future session API—not Unreal
clients—will own `StartMatchmaking`, ticket reads, cancellation, and the
mapping from an authenticated player to a ticket. Any managed queue/fleet must
remain behind the existing Terraform consent, expiry, and teardown process.
