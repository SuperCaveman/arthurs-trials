# Local Session API

This is a dependency-free, local implementation of the session boundary in
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

The Anywhere adapter invokes the AWS CLI from the API process; the Unreal
client never receives AWS credentials. This is the local stand-in for the
future ECS task role and AWS SDK implementation.

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
