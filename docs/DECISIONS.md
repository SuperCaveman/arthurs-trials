# Architecture decisions

These records document the decisions that shape Arthur's Trials. They distinguish
the local proof from the optional managed-cloud demonstration.

## ADR-001 — Use GameLift Servers Anywhere for development

**Status:** Accepted

**Decision:** Run the Unreal dedicated server against a GameLift Servers
Anywhere fleet with the workstation registered as compute during normal
development.

**Why:** It exercises the real Server SDK lifecycle and GameLift session
operations without keeping managed EC2 capacity running. It also lets the
project prove `InitSDK`, `ProcessReady`, health checks, player-session handling,
and graceful termination before any cloud hosting cost is introduced.

**Trade-off:** A workstation is not a substitute for managed capacity,
regional placement, or a production network. All public material labels this as
the local proof, not a scale test.

## ADR-002 — Keep AWS credentials out of the Unreal client

**Status:** Accepted

**Decision:** The client receives only connection details and a GameLift-issued
player-session ID. A future authenticated session API owns placement and
player-session creation.

**Why:** A player-session ID is a narrowly scoped join credential that the
dedicated server validates with `AcceptPlayerSession`. Shipping AWS credentials
or broad GameLift API permissions in a game client would create an unacceptable
trust boundary.

**Trade-off:** The local development helper temporarily represents the future
control plane. It is documented as a helper, not presented as a public API.

## ADR-003 — Require server-side player-session validation

**Status:** Accepted; runtime proof pending linked server binary

**Decision:** When launched with `-GameLiftRequirePlayerSession`, the dedicated
server rejects a join with no player-session ID, calls `AcceptPlayerSession`
before admission, and calls `RemovePlayerSession` when the controller logs out.

**Why:** It ensures GameLift player-slot state reflects actual server admission
instead of treating a raw IP/port connection as authorization.

**Trade-off:** The first local proof needs a separate player-session creation
step. That extra step is valuable evidence of the production trust boundary.

## ADR-004 — Make managed-cloud infrastructure opt-in and short-lived

**Status:** Accepted

**Decision:** VPC, ALB, ECS/Fargate, RDS, SQS, managed GameLift hosting, and
related monitoring remain planned until an explicitly approved, time-boxed demo.

**Why:** The portfolio needs evidence of sound design and operational judgment,
not permanently running hobby infrastructure. Default-off resources, budgets,
tags, and a teardown runbook keep the design financially honest.

**Trade-off:** Some production architecture remains documented rather than
deployed. The implementation-status ledger makes that distinction explicit.

## ADR-005 — Start with one region and no FlexMatch dependency

**Status:** Accepted

**Decision:** The first proof uses one GameLift location and direct
game-session/player-session creation. FlexMatch and multi-region queues remain
future enhancements.

**Why:** The core proof is dedicated-server lifecycle correctness, secure player
admission, and reproducibility. Adding matchmaking before those work creates
cost and debugging surface without strengthening the first demo.

**Trade-off:** The project cannot claim live matchmaking or regional latency
optimization until those components are implemented and tested.

## ADR-006 — Keep infrastructure code default-off and demo-expiring

**Status:** Accepted

**Decision:** Terraform is included as a production-shaped portfolio artifact,
but its default mode plans no AWS resources. A managed demo requires an
explicit deployment mode, a separate allow flag, and an RFC3339 expiry tag.
The initial network module avoids a NAT gateway.

**Why:** An occasional portfolio demonstration does not justify a fixed hourly
network charge. Default-off infrastructure makes the cost boundary clear while
keeping the intended platform path inspectable.

**Trade-off:** The later container design must make an explicit
endpoint-versus-NAT decision before it can be deployed in private subnets.

## ADR-007 — Establish identity and CI trust without standing cloud access

**Status:** Accepted

**Decision:** Keep Cognito and GitHub Actions OIDC as opt-in Terraform modules
behind the same managed-demo gate as the network. The GitHub trust role is
bound to this repository's `main` branch and starts with no permissions.

**Why:** The project needs a credible identity and delivery boundary without
adding user-management work, stored AWS keys, or an always-available deployment
path before the managed architecture is ready. A permissionless trust role
makes it explicit that a future release must earn narrowly scoped access per
resource module.

**Trade-off:** No live Cognito sign-in or OIDC deployment exists yet. The local
bearer-token adapter remains development-only, and no public material may
describe the templates as deployed authentication or CI/CD delivery.
