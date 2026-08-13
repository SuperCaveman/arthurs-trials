import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';
import { once } from 'node:events';
import { createCognitoJwtAuthenticator, createSessionApi } from '../src/server.mjs';

async function startApi({ authenticate } = {}) {
  let calls = 0;
  let lastCreateMatchRequest;
  const server = createSessionApi({
    adapter: {
      async createMatch(request) {
        calls += 1;
        lastCreateMatchRequest = request;
        return {
          address: '127.0.0.1',
          port: 7778,
          playerSessionId: `psess_test_${request.playerId}`,
          expiresAt: '2030-01-01T00:00:00.000Z',
        };
      },
    },
    authenticate,
    logger: { info() {}, error() {} },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    calls: () => calls,
    lastCreateMatchRequest: () => lastCreateMatchRequest,
    close: () => server.close(),
  };
}

function createSignedCognitoAccessToken({ issuer, clientId, overrides = {} }) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' });
  jwk.kid = 'local-test-key';
  jwk.use = 'sig';
  jwk.alg = 'RS256';
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'RS256', kid: jwk.kid, typ: 'JWT' });
  const claims = encode({
    sub: 'cognito-player-123',
    iss: issuer,
    token_use: 'access',
    client_id: clientId,
    exp: Math.floor(Date.now() / 1_000) + 300,
    ...overrides,
  });
  const signature = sign('RSA-SHA256', Buffer.from(`${header}.${claims}`), privateKey).toString('base64url');
  return { token: `${header}.${claims}.${signature}`, jwk };
}

function requestHeaders(playerId, idempotencyKey) {
  return {
    authorization: `Bearer local-dev-${playerId}`,
    'idempotency-key': idempotencyKey,
    'content-type': 'application/json',
  };
}

test('creates a ready match and reuses it for the same idempotency key', async (t) => {
  const api = await startApi();
  t.after(api.close);
  const headers = requestHeaders('andrew', '0ba8f5e0-9b45-47d3-9ac5-18da58b46c31');
  const body = JSON.stringify({ mode: 'co-op-defense', region: 'us-east-1', party: ['andrew'] });

  const first = await fetch(`${api.baseUrl}/v1/matches`, { method: 'POST', headers, body });
  const firstMatch = await first.json();
  const replay = await fetch(`${api.baseUrl}/v1/matches`, { method: 'POST', headers, body });
  const replayMatch = await replay.json();

  assert.equal(first.status, 201);
  assert.equal(firstMatch.status, 'READY');
  assert.equal(replay.status, 200);
  assert.equal(replayMatch.matchRequestId, firstMatch.matchRequestId);
  assert.equal(api.calls(), 1);
  assert.deepEqual(api.lastCreateMatchRequest(), {
    playerId: 'andrew',
    maximumPlayerSessions: 4,
    matchRequestId: firstMatch.matchRequestId,
    party: ['andrew'],
    xpAward: 125,
  });
});

test('exposes an unauthenticated health endpoint without match data', async (t) => {
  const api = await startApi();
  t.after(api.close);

  const response = await fetch(`${api.baseUrl}/healthz`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', service: 'session-api' });
});

test('rejects unauthenticated callers and parties that exclude the caller', async (t) => {
  const api = await startApi();
  t.after(api.close);
  const payload = JSON.stringify({ mode: 'co-op-defense', region: 'us-east-1', party: ['other-player'] });

  const unauthenticated = await fetch(`${api.baseUrl}/v1/matches`, { method: 'POST', body: payload });
  const unauthorizedParty = await fetch(`${api.baseUrl}/v1/matches`, {
    method: 'POST',
    headers: requestHeaders('andrew', '9a8146e1-7e90-4353-9fca-3afce3bd3632'),
    body: payload,
  });

  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthorizedParty.status, 403);
  assert.equal(api.calls(), 0);
});

test('only the owning player can read a match request', async (t) => {
  const api = await startApi();
  t.after(api.close);
  const create = await fetch(`${api.baseUrl}/v1/matches`, {
    method: 'POST',
    headers: requestHeaders('andrew', '69da9bb2-2fea-48d8-85a0-39472d9c2152'),
    body: JSON.stringify({ mode: 'co-op-defense', region: 'us-east-1', party: ['andrew'] }),
  });
  const created = await create.json();
  const foreignRead = await fetch(`${api.baseUrl}/v1/matches/${created.matchRequestId}`, {
    headers: { authorization: 'Bearer local-dev-other-player' },
  });
  const ownerRead = await fetch(`${api.baseUrl}/v1/matches/${created.matchRequestId}`, {
    headers: { authorization: 'Bearer local-dev-andrew' },
  });

  assert.equal(foreignRead.status, 403);
  assert.equal(ownerRead.status, 200);
});

test('accepts a verified Cognito-shaped access token without contacting AWS', async (t) => {
  const issuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_localtest';
  const clientId = 'localtestclient123';
  const { token, jwk } = createSignedCognitoAccessToken({ issuer, clientId });
  let jwksRequests = 0;
  const authenticate = createCognitoJwtAuthenticator({
    issuer,
    clientId,
    fetchFn: async () => {
      jwksRequests += 1;
      return { ok: true, json: async () => ({ keys: [jwk] }) };
    },
  });
  const api = await startApi({ authenticate });
  t.after(api.close);

  const response = await fetch(`${api.baseUrl}/v1/matches`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'idempotency-key': 'b28fc6c9-4243-4f41-b10b-21a842a496ac',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ mode: 'co-op-defense', region: 'us-east-1', party: ['cognito-player-123'] }),
  });

  assert.equal(response.status, 201);
  assert.equal(api.lastCreateMatchRequest().playerId, 'cognito-player-123');
  assert.equal(jwksRequests, 1);
});

test('rejects a Cognito token with the wrong client audience before placement', async (t) => {
  const issuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_localtest';
  const clientId = 'localtestclient123';
  const { token, jwk } = createSignedCognitoAccessToken({ issuer, clientId, overrides: { client_id: 'wrongclient123' } });
  const authenticate = createCognitoJwtAuthenticator({
    issuer,
    clientId,
    fetchFn: async () => ({ ok: true, json: async () => ({ keys: [jwk] }) }),
  });
  const api = await startApi({ authenticate });
  t.after(api.close);

  const response = await fetch(`${api.baseUrl}/v1/matches`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'idempotency-key': 'bb3d3d43-a0ce-47aa-8971-f0145708f0c1',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ mode: 'co-op-defense', region: 'us-east-1', party: ['cognito-player-123'] }),
  });

  assert.equal(response.status, 401);
  assert.equal(api.calls(), 0);
});
