# Session API contract (planned control plane)

Status: **local development implementation available; not deployed**

The local GameLift Anywhere scripts prove the server-side lifecycle. This API is
the production-shaped replacement for those scripts: it is the only component
that receives an authenticated player request and calls GameLift placement or
player-session APIs. Unreal clients never receive AWS credentials.

## Trust boundary

```text
Unreal client + Cognito JWT
        |
        v
Session API (private ECS/Fargate task behind public ALB)
        |
        +--> player/session data (private RDS)
        |
        +--> GameLift placement and player-session APIs
        |
        v
Unreal dedicated server validates PlayerSessionId with GameLift
```

The API returns a connection address and a GameLift-issued `playerSessionId`.
The client supplies that ID during the Unreal connection attempt. The server
calls `AcceptPlayerSession` before admitting the player.

## Endpoints

### `POST /v1/matches`

Requests a match for the authenticated player.

Headers:

```http
Authorization: Bearer <Cognito access token>
Idempotency-Key: <client-generated UUID>
Content-Type: application/json
```

Request:

```json
{
  "mode": "co-op-defense",
  "region": "us-east-1",
  "party": ["player-123"],
  "latencies": {
    "player-123": 42
  }
}
```

Rules:

- The API derives the caller identity from the validated token; it does not
  trust a player ID supplied in the body.
- The caller may request only a party they own or are authorized to lead.
- `Idempotency-Key` is stored with the request result. Retrying the same key
  returns the original placement rather than creating extra player sessions.
- The first implementation targets one region and four-player co-op. Region
  selection and FlexMatch are intentionally deferred.
- `latencies` is optional for the local fake and direct Anywhere adapters. The
  managed queue adapter requires one integer millisecond measurement for every
  player in the party and maps it to GameLift `PlayerLatencies`. Production
  values come from UDP ping beacons rather than ICMP ping.

Accepted response while placement is pending:

```json
{
  "matchRequestId": "mrq_01J...",
  "status": "PLACEMENT_PENDING",
  "pollAfterSeconds": 2
}
```

Completed response:

```json
{
  "matchRequestId": "mrq_01J...",
  "status": "READY",
  "connection": {
    "address": "203.0.113.10",
    "port": 7777,
    "playerSessionId": "psess-..."
  },
  "expiresAt": "2026-08-10T20:15:00Z"
}
```

`playerSessionId` is a connection credential, not an AWS credential. It must
not be written to client analytics, screenshots, or public logs.

### `GET /v1/matches/{matchRequestId}`

Returns the request state for its authenticated owner: `PLACEMENT_PENDING`,
`READY`, `FAILED`, `CANCELLED`, or `EXPIRED`.

### `DELETE /v1/matches/{matchRequestId}`

Cancels a request only while no player session has been activated. The API
records a cancellation reason for support and metrics.

## Failure behavior

| Condition | HTTP result | Client behavior | Operational signal |
| --- | --- | --- | --- |
| Invalid or expired JWT | `401` | Reauthenticate. | Authentication failure metric. |
| Caller is not party owner | `403` | Do not retry automatically. | Authorization audit event. |
| Same idempotency key | `200` with original result | Reuse the original response. | Idempotency-hit metric. |
| No available capacity | `409` / `PLACEMENT_PENDING` | Poll within the supplied interval; show queue state. | Placement wait/failure metric. The local API test maps GameLift's `FleetCapacityExceededException` to this response without exposing AWS details. |
| Placement failed | `503` | Offer retry with a new idempotency key after a backoff. | Placement-failure alarm. |
| Player session expired | `410` | Request a new match connection. | Expired-session metric. |

## Local-development mapping

The local API now exposes the client-facing boundary. It defaults to a fake
adapter for unit and HTTP-contract tests, and its `anywhere` adapter uses the
official GameLift AWS SDK only from the API process. A separately tested `queue` adapter
uses `StartGameSessionPlacement`, waits for a fulfilled placement, and returns
the caller's already-created GameLift player-session reservation. The existing
scripts remain the local operator tools for starting and stopping the server
process:

| Planned API responsibility | Local helper |
| --- | --- |
| Start a server process | `Start-GameLiftAnywhereLocal.ps1` |
| Create a game session and reserve the caller's player slot | `api/src/server.mjs` with `GAME_LIFT_ADAPTER=anywhere` |
| End the session cleanly | `Stop-GameLiftAnywhereSession.ps1` |

The Anywhere adapter has been exercised end-to-end against the local dedicated
server; see the [redacted local proof](evidence/SESSION_API_ANYWHERE_PROOF.md).
The local bearer token is development-only. A Cognito-compatible RS256/JWKS
verifier is now locally tested with generated keys: it checks access-token
issuer, client ID, expiry, token use, signing key, and signature before
creating a match. A separate optional local file store uses atomic replacement
to retain match ownership/idempotency across one API restart. It is explicitly
single-process development persistence, not a database. No live user pool or
sign-in has been tested, so Cognito integration, transactional RDS persistence,
and an ECS task role remain managed-demo work.

The queue adapter has no live queue proof yet. It is source- and mock-tested
only, and must not be described as deployed until an approved managed demo
shows placement, a player admission, a timeout/failure, and a cleanup.
