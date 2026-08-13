# Local Session API

This is a small, local implementation of the session boundary in
[`docs/SESSION_API_CONTRACT.md`](../docs/SESSION_API_CONTRACT.md). It is not an
internet-facing production service. Its default local mode accepts only local
development tokens; an opt-in Cognito-compatible JWT verifier is tested with a
locally generated RSA key and does not require an AWS user pool.

## What it proves locally

- the client calls an API rather than AWS GameLift directly;
- the API derives the local caller from a bearer token and enforces party
  ownership;
- idempotency keys prevent duplicate match/session creation;
- only the API adapter calls GameLift; and
- clients receive only address, port, and a short-lived player-session
  credential.
- an optional API path verifies a signed Cognito access token's issuer, client
  ID, expiry, token type, signature, and JWKS key ID before placement.
- an opt-in local file store preserves match ownership and idempotency across
  an API restart using an atomic write/rename.

## Run without AWS

```powershell
cd api
$env:GAME_LIFT_ADAPTER = 'fake'
npm test
npm start
```

In another terminal, request a local match as `andrew`:

```powershell
$headers = @{
  Authorization = 'Bearer local-dev-andrew'
  'Idempotency-Key' = [guid]::NewGuid().ToString()
  'Content-Type' = 'application/json'
}
Invoke-RestMethod http://127.0.0.1:8080/v1/matches -Method Post -Headers $headers -Body (@{
  mode = 'co-op-defense'
  region = 'us-east-1'
  party = @('andrew')
} | ConvertTo-Json)
```

## Cognito-compatible verifier (local test only)

The `cognito` mode is disabled unless selected explicitly. It fetches only the
configured issuer's JWKS endpoint and verifies RS256 access tokens; it does not
create a user pool or make GameLift calls by itself.

```powershell
$env:SESSION_API_AUTH_MODE = 'cognito'
$env:COGNITO_ISSUER = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_REPLACE_ME'
$env:COGNITO_CLIENT_ID = 'REPLACE_WITH_PUBLIC_CLIENT_ID'
npm start
```

Do not put a JWT, player-session ID, or user email in a screenshot or log. The
repository test generates an ephemeral RSA key and proves valid and wrong-client
tokens locally; a live Cognito sign-in remains an opt-in managed-demo task.

## Durable local match state

`memory` is the safe default for ordinary tests. To prove restart-safe local
idempotency without a database service, set the optional file-store path:

```powershell
$env:SESSION_API_STORE = 'file'
$env:SESSION_API_STORE_PATH = '..\logs\session-api-store.json'
npm start
```

The file adapter is intentionally single-process and local only. It atomically
replaces its state file, but does not provide database transactions, concurrent
writer protection, backups, encryption at rest, or cross-instance sharing.
RDS PostgreSQL is still the planned managed implementation.

## Connect to the local GameLift Anywhere fleet

Start the local dedicated server first with
`../scripts/Start-GameLiftAnywhereLocal.ps1`. Then set the three GameLift
variables from the untracked `../scripts/GameLiftAnywhere.dev.psd1` file:

```powershell
$env:GAME_LIFT_ADAPTER = 'anywhere'
$env:AWS_REGION = 'us-east-1'
$env:GAME_LIFT_FLEET_ID = 'fleet-REPLACE_ME'
$env:GAME_LIFT_LOCATION = 'custom-arthurs-trials-local'
npm start
```

The Anywhere adapter uses the official GameLift AWS SDK from the API process;
the Unreal client never receives AWS credentials. In an ECS task, the SDK uses
the task role rather than a bundled CLI or stored key. Local Anywhere testing
continues to use the workstation's existing AWS credential chain.

## Managed GameLift queue adapter (template only)

`queue` is a separate, opt-in adapter for the managed hosting design. It calls
`StartGameSessionPlacement`, polls the placement status, and returns **only the
calling player's** reservation from GameLift's fulfilled placement. It does not
call `CreatePlayerSession` after placement because the queue request already
creates reservations for the party.

This adapter is unit-tested with a local mock; no queue exists and no AWS call
is made unless you explicitly start the API in this mode. A future approved
managed run needs a real queue, task role, egress path, Cognito configuration,
and measured latency for every party member:

```powershell
$env:GAME_LIFT_ADAPTER = 'queue'
$env:AWS_REGION = 'us-east-1'
$env:GAME_LIFT_QUEUE_NAME = 'arthurs-trials-demo-queue'
$env:SESSION_API_AUTH_MODE = 'cognito'
npm start
```

The placement request body must include a complete `latencies` map, in
milliseconds, for every party member. It is converted to the GameLift
`PlayerLatencies` shape using the requested region. Real clients should obtain
those values from GameLift UDP ping beacons, not ICMP. See the [queue/capacity
design](../docs/GAMELIFT_CAPACITY_PLACEMENT.md). Never put queue/fleet details,
access tokens, or player-session IDs in recordings.

With the API and local server running, use the repeatable end-to-end client
check from the repository root:

```powershell
./scripts/Test-SessionApiAnywhereE2E.ps1
```

## Run the same API as a local container

The container defaults to the fake adapter, so this creates no AWS resources
or API calls:

```powershell
docker build -t arthurs-trials-session-api:local .
docker run --rm -p 8080:8080 arthurs-trials-session-api:local
```

In another terminal, check its orchestrator-style health endpoint:

```powershell
Invoke-RestMethod http://127.0.0.1:8080/healthz
```

The future Linux dedicated-server image requirements are documented in
[`../containers/server/README.md`](../containers/server/README.md).
