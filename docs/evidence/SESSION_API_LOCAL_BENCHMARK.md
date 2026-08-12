# Local session API benchmark evidence

**Captured:** 2026-08-10

The repository's local benchmark ran with Node.js v24.14.0, the in-process
fake GameLift adapter, 40 HTTP requests, and concurrency 10.

```json
{
  "successfulRequests": 40,
  "failedRequests": 0,
  "latencyMs": {
    "p50": 6.04,
    "p95": 26.59,
    "max": 29.86
  }
}
```

This measures only local HTTP/API/idempotency overhead. It makes no AWS API
calls and does not measure GameLift placement, Unreal server tick rate, player
capacity, network latency, or managed-cloud performance.
