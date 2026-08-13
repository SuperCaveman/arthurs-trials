import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createPublicKey, randomUUID, verify as verifySignature } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createFileMatchStore, createInMemoryMatchStore } from './match-store.mjs';

const execFileAsync = promisify(execFile);
const MAX_BODY_BYTES = 16 * 1024;
const MAX_PARTY_SIZE = 4;
const LOCAL_TOKEN_PATTERN = /^Bearer local-dev-([A-Za-z0-9._-]{3,64})$/;
const GAME_SESSION_READY_TIMEOUT_MS = 20_000;
const GAME_SESSION_PLACEMENT_TIMEOUT_MS = 20_000;
const COGNITO_JWKS_CACHE_MS = 5 * 60 * 1_000;
const COGNITO_JWKS_TIMEOUT_MS = 3_000;

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function capacityUnavailable() {
  const error = new Error('No game-server capacity is currently available.');
  error.code = 'GAME_SERVER_CAPACITY_UNAVAILABLE';
  return error;
}

function publicMatch(match) {
  const { ownerId, ...response } = match;
  return response;
}

async function readJson(request) {
  let size = 0;
  let raw = '';
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('Request body is too large.');
      error.statusCode = 413;
      throw error;
    }
    raw += chunk;
  }

  try {
    return JSON.parse(raw || '{}');
  } catch {
    const error = new Error('Request body must be valid JSON.');
    error.statusCode = 400;
    throw error;
  }
}

function unauthorized(message = 'A valid player credential is required.') {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
}

function requireBearerToken(request, message) {
  const token = /^Bearer ([A-Za-z0-9._-]{1,16384})$/.exec(request.headers.authorization ?? '')?.[1];
  if (!token) throw unauthorized(message);
  return token;
}

export function createLocalAuthenticator() {
  return async (request) => {
    const match = LOCAL_TOKEN_PATTERN.exec(request.headers.authorization ?? '');
    if (!match) throw unauthorized('A local development bearer token is required.');
    return { id: match[1], authMode: 'local' };
  };
}

function parseBase64UrlJson(value) {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw unauthorized('A valid Cognito access token is required.');
  }
}

function validateCognitoClaims(claims, { issuer, clientId, now }) {
  const nowSeconds = Math.floor(now() / 1_000);
  const validSubject = typeof claims.sub === 'string' && /^[A-Za-z0-9._-]{3,128}$/.test(claims.sub);
  const validExpiry = typeof claims.exp === 'number' && Number.isFinite(claims.exp) && claims.exp > nowSeconds;
  const validNotBefore = claims.nbf === undefined
    || (typeof claims.nbf === 'number' && Number.isFinite(claims.nbf) && claims.nbf <= nowSeconds + 60);

  if (
    claims.iss !== issuer
    || claims.token_use !== 'access'
    || claims.client_id !== clientId
    || !validSubject
    || !validExpiry
    || !validNotBefore
  ) {
    throw unauthorized('A valid Cognito access token is required.');
  }

  return { id: claims.sub, authMode: 'cognito' };
}

// Cognito access tokens are signed with an RSA key advertised at the user
// pool's JWKS endpoint. The resolver is injectable so this path can be tested
// locally without a user pool, network call, or AWS resource.
export function createCognitoJwtAuthenticator({
  issuer,
  clientId,
  jwksUri = `${issuer}/.well-known/jwks.json`,
  fetchFn = fetch,
  now = () => Date.now(),
} = {}) {
  if (typeof issuer !== 'string' || !issuer.startsWith('https://')) {
    throw new Error('COGNITO_ISSUER must be an HTTPS user-pool issuer URL.');
  }
  if (typeof clientId !== 'string' || !/^[A-Za-z0-9_]{3,128}$/.test(clientId)) {
    throw new Error('COGNITO_CLIENT_ID must be a valid Cognito app client ID.');
  }

  let cachedKeys = new Map();
  let cacheExpiresAt = 0;

  async function loadKeys(forceRefresh = false) {
    if (!forceRefresh && cacheExpiresAt > now()) return cachedKeys;

    let response;
    try {
      response = await fetchFn(jwksUri, { signal: AbortSignal.timeout(COGNITO_JWKS_TIMEOUT_MS) });
    } catch {
      throw unauthorized('Cognito token verification is temporarily unavailable.');
    }
    if (!response?.ok) throw unauthorized('Cognito token verification is temporarily unavailable.');

    let document;
    try {
      document = await response.json();
    } catch {
      throw unauthorized('Cognito token verification is temporarily unavailable.');
    }
    if (!Array.isArray(document.keys)) throw unauthorized('Cognito token verification is temporarily unavailable.');

    const nextKeys = new Map();
    for (const key of document.keys) {
      if (key?.kty === 'RSA' && key.use === 'sig' && key.kid && key.n && key.e) {
        nextKeys.set(key.kid, key);
      }
    }
    if (nextKeys.size === 0) throw unauthorized('Cognito token verification is temporarily unavailable.');
    cachedKeys = nextKeys;
    cacheExpiresAt = now() + COGNITO_JWKS_CACHE_MS;
    return cachedKeys;
  }

  return async (request) => {
    const token = requireBearerToken(request, 'A Cognito access token is required.');
    const parts = token.split('.');
    if (parts.length !== 3) throw unauthorized('A valid Cognito access token is required.');

    const header = parseBase64UrlJson(parts[0]);
    const claims = parseBase64UrlJson(parts[1]);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
      throw unauthorized('A valid Cognito access token is required.');
    }

    let jwk = (await loadKeys()).get(header.kid);
    if (!jwk) jwk = (await loadKeys(true)).get(header.kid);
    if (!jwk) throw unauthorized('A valid Cognito access token is required.');

    let signatureValid = false;
    try {
      const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
      signatureValid = verifySignature(
        'RSA-SHA256',
        Buffer.from(`${parts[0]}.${parts[1]}`),
        publicKey,
        Buffer.from(parts[2], 'base64url'),
      );
    } catch {
      throw unauthorized('A valid Cognito access token is required.');
    }
    if (!signatureValid) throw unauthorized('A valid Cognito access token is required.');
    return validateCognitoClaims(claims, { issuer, clientId, now });
  };
}

function validateMatchRequest(body, principal) {
  if (body.mode !== 'co-op-defense') {
    const error = new Error('Only co-op-defense is available in the local proof.');
    error.statusCode = 400;
    throw error;
  }
  if (body.region !== 'us-east-1') {
    const error = new Error('Only us-east-1 is available in the local proof.');
    error.statusCode = 400;
    throw error;
  }
  if (!Array.isArray(body.party) || body.party.length < 1 || body.party.length > MAX_PARTY_SIZE) {
    const error = new Error('party must contain between one and four players.');
    error.statusCode = 400;
    throw error;
  }
  if (!body.party.every((player) => typeof player === 'string' && /^[A-Za-z0-9._-]{3,64}$/.test(player))) {
    const error = new Error('party contains an invalid player identifier.');
    error.statusCode = 400;
    throw error;
  }
  if (!body.party.includes(principal.id)) {
    const error = new Error('The caller must be included in the party.');
    error.statusCode = 403;
    throw error;
  }

  if (body.latencies === undefined) return undefined;
  if (body.latencies === null || Array.isArray(body.latencies) || typeof body.latencies !== 'object') {
    const error = new Error('latencies must map every party player to an integer latency in milliseconds.');
    error.statusCode = 400;
    throw error;
  }
  const partyIds = [...body.party].sort();
  const latencyIds = Object.keys(body.latencies).sort();
  if (JSON.stringify(partyIds) !== JSON.stringify(latencyIds)
    || !latencyIds.every((playerId) => Number.isInteger(body.latencies[playerId]) && body.latencies[playerId] >= 1 && body.latencies[playerId] <= 1000)) {
    const error = new Error('latencies must map every party player to an integer latency in milliseconds.');
    error.statusCode = 400;
    throw error;
  }
  return body.party.map((playerId) => ({
    PlayerId: playerId,
    RegionIdentifier: body.region,
    LatencyInMilliseconds: body.latencies[playerId],
  }));
}

export function createFakeGameLiftAdapter() {
  let sequence = 0;
  return {
    async createMatch({ playerId }) {
      sequence += 1;
      return {
        address: '127.0.0.1',
        port: 7778,
        playerSessionId: `psess_fake_${sequence}_${playerId}`,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      };
    },
  };
}

function requiredEnvironment(name, environment) {
  const value = environment[name];
  if (!value) {
    throw new Error(`${name} is required when a GameLift adapter is selected.`);
  }
  return value;
}

async function awsJson(args) {
  try {
    const { stdout } = await execFileAsync('aws', args, { windowsHide: true });
    return JSON.parse(stdout);
  } catch (error) {
    // AWS CLI uses FleetCapacityExceededException when no Anywhere process
    // can reserve a game session. Preserve that meaning for the API response
    // without returning raw AWS error details to a player.
    if (/FleetCapacityExceededException/i.test(`${error.stderr ?? ''}\n${error.message ?? ''}`)) {
      throw capacityUnavailable();
    }
    throw error;
  }
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForActiveGameSession({ gameSessionId, region }) {
  const deadline = Date.now() + GAME_SESSION_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const gameSession = (await awsJson([
      'gamelift', 'describe-game-sessions',
      '--region', region,
      '--game-session-id', gameSessionId,
      '--output', 'json',
    ])).GameSessions?.[0];
    if (gameSession?.Status === 'ACTIVE') return gameSession;
    if (['TERMINATED', 'ERROR'].includes(gameSession?.Status)) {
      throw new Error(`GameLift session entered ${gameSession.Status} before placement completed.`);
    }
    await sleep(1_000);
  }
  throw new Error('Timed out waiting for GameLift to activate the game session.');
}

export function createAnywhereGameLiftAdapter(environment = process.env) {
  const region = requiredEnvironment('AWS_REGION', environment);
  const fleetId = requiredEnvironment('GAME_LIFT_FLEET_ID', environment);
  const location = requiredEnvironment('GAME_LIFT_LOCATION', environment);

  return {
    async createMatch({ playerId, maximumPlayerSessions, matchRequestId, party, xpAward }) {
      const gameSession = (await awsJson([
        'gamelift', 'create-game-session',
        '--region', region,
        '--fleet-id', fleetId,
        '--location', location,
        '--name', `api-local-${randomUUID()}`,
        '--maximum-player-session-count', String(maximumPlayerSessions),
        '--game-properties',
        `Key=matchId,Value=${matchRequestId}`,
        `Key=participants,Value=${party.join(',')}`,
        `Key=xpAward,Value=${xpAward}`,
        '--output', 'json',
      ])).GameSession;

      const activeGameSession = await waitForActiveGameSession({
        gameSessionId: gameSession.GameSessionId,
        region,
      });
      const playerSession = (await awsJson([
        'gamelift', 'create-player-session',
        '--region', region,
        '--game-session-id', gameSession.GameSessionId,
        '--player-id', playerId,
        '--output', 'json',
      ])).PlayerSession;

      return {
        address: playerSession.IpAddress ?? activeGameSession.IpAddress,
        port: playerSession.Port ?? activeGameSession.Port,
        playerSessionId: playerSession.PlayerSessionId,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      };
    },
  };
}

async function waitForFulfilledPlacement({ placementId, region, awsJsonFn, sleepFn, timeoutMilliseconds }) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    const placement = (await awsJsonFn([
      'gamelift', 'describe-game-session-placement',
      '--region', region,
      '--placement-id', placementId,
      '--output', 'json',
    ])).GameSessionPlacement;
    if (placement?.Status === 'FULFILLED') return placement;
    if (['FAILED', 'TIMED_OUT', 'CANCELLED'].includes(placement?.Status)) throw capacityUnavailable();
    await sleepFn(1_000);
  }
  throw capacityUnavailable();
}

// This is the managed-hosting adapter. It is intentionally distinct from the
// direct Anywhere proof: GameLift creates all party reservations during a
// queue placement and the API returns only the caller's reservation.
export function createQueueGameLiftAdapter(environment = process.env, {
  awsJsonFn = awsJson,
  sleepFn = sleep,
  timeoutMilliseconds = GAME_SESSION_PLACEMENT_TIMEOUT_MS,
} = {}) {
  const region = requiredEnvironment('AWS_REGION', environment);
  const queueName = requiredEnvironment('GAME_LIFT_QUEUE_NAME', environment);

  return {
    async createMatch({ playerId, maximumPlayerSessions, matchRequestId, party, xpAward, playerLatencies }) {
      if (!Array.isArray(playerLatencies) || playerLatencies.length !== party.length) {
        throw new Error('Measured latency is required for every party player when GAME_LIFT_ADAPTER=queue.');
      }
      const placementId = randomUUID();
      await awsJsonFn([
        'gamelift', 'start-game-session-placement',
        '--region', region,
        '--placement-id', placementId,
        '--game-session-queue-name', queueName,
        '--game-session-name', `match-${placementId}`,
        '--maximum-player-session-count', String(maximumPlayerSessions),
        '--desired-player-sessions', ...party.map((id) => `PlayerId=${id}`),
        '--player-latencies', ...playerLatencies.map((latency) => (
          `PlayerId=${latency.PlayerId},RegionIdentifier=${latency.RegionIdentifier},LatencyInMilliseconds=${latency.LatencyInMilliseconds}`
        )),
        '--game-properties',
        `Key=matchId,Value=${matchRequestId}`,
        `Key=participants,Value=${party.join(',')}`,
        `Key=xpAward,Value=${xpAward}`,
        '--output', 'json',
      ]);

      const placement = await waitForFulfilledPlacement({
        placementId,
        region,
        awsJsonFn,
        sleepFn,
        timeoutMilliseconds,
      });
      const reservation = placement.PlacedPlayerSessions?.find((session) => session.PlayerId === playerId);
      if (!reservation?.PlayerSessionId || !(placement.IpAddress ?? placement.DnsName) || !placement.Port) {
        throw new Error('Fulfilled GameLift placement did not return caller connection details.');
      }
      return {
        address: placement.IpAddress ?? placement.DnsName,
        port: placement.Port,
        playerSessionId: reservation.PlayerSessionId,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      };
    },
  };
}

export function createSessionApi({
  adapter = createFakeGameLiftAdapter(),
  authenticate = createLocalAuthenticator(),
  store = createInMemoryMatchStore(),
  logger = console,
} = {}) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');

      // Intended for container/orchestrator health checks. It exposes no
      // match or player data and does not require a player credential.
      if (request.method === 'GET' && url.pathname === '/healthz') {
        return sendJson(response, 200, { status: 'ok', service: 'session-api' });
      }

      const principal = await authenticate(request);

      if (request.method === 'POST' && url.pathname === '/v1/matches') {
        const idempotencyKey = request.headers['idempotency-key'];
        if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9-]{16,128}$/.test(idempotencyKey)) {
          return sendJson(response, 400, { error: 'A UUID-shaped Idempotency-Key is required.' });
        }

        const existingMatch = await store.getByIdempotency(principal.id, idempotencyKey);
        if (existingMatch) {
          return sendJson(response, 200, publicMatch(existingMatch));
        }

        const body = await readJson(request);
        const playerLatencies = validateMatchRequest(body, principal);
        const matchRequestId = `mrq_${randomUUID()}`;
        const matchInput = {
          playerId: principal.id,
          maximumPlayerSessions: MAX_PARTY_SIZE,
          matchRequestId,
          party: body.party,
          xpAward: 125,
        };
        if (playerLatencies) matchInput.playerLatencies = playerLatencies;
        const connection = await adapter.createMatch(matchInput);
        const match = {
          matchRequestId,
          status: 'READY',
          connection,
          expiresAt: connection.expiresAt,
          ownerId: principal.id,
        };
        await store.save(match, idempotencyKey);
        logger.info?.({ event: 'match_ready', matchRequestId: match.matchRequestId, authMode: principal.authMode });
        return sendJson(response, 201, publicMatch(match));
      }

      const matchId = /^\/v1\/matches\/(mrq_[A-Za-z0-9-]+)$/.exec(url.pathname)?.[1];
      if (matchId && request.method === 'GET') {
        const match = await store.getById(matchId);
        if (!match) return sendJson(response, 404, { error: 'Match request was not found.' });
        if (match.ownerId !== principal.id) return sendJson(response, 403, { error: 'Match request belongs to another player.' });
        return sendJson(response, 200, publicMatch(match));
      }

      if (matchId && request.method === 'DELETE') {
        const match = await store.getById(matchId);
        if (!match) return sendJson(response, 404, { error: 'Match request was not found.' });
        if (match.ownerId !== principal.id) return sendJson(response, 403, { error: 'Match request belongs to another player.' });
        return sendJson(response, 409, { error: 'READY local matches cannot be cancelled after a player session is issued.' });
      }

      return sendJson(response, 404, { error: 'Route was not found.' });
    } catch (error) {
      if (error.code === 'GAME_SERVER_CAPACITY_UNAVAILABLE') {
        logger.info?.({ event: 'match_placement_pending', reason: 'capacity_unavailable' });
        return sendJson(response, 409, {
          error: 'No game-server capacity is currently available.',
          status: 'PLACEMENT_PENDING',
          pollAfterSeconds: 2,
        });
      }
      const statusCode = error.statusCode ?? 503;
      if (statusCode >= 500) logger.error?.({ event: 'session_api_error', message: error.message });
      return sendJson(response, statusCode, { error: error.statusCode ? error.message : 'Game session placement is unavailable.' });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.SESSION_API_PORT ?? 8080);
  const host = process.env.SESSION_API_HOST ?? '127.0.0.1';
  const adapterName = process.env.GAME_LIFT_ADAPTER ?? 'fake';
  const authMode = process.env.SESSION_API_AUTH_MODE ?? 'local';
  const storeName = process.env.SESSION_API_STORE ?? 'memory';
  const adapter = adapterName === 'anywhere'
    ? createAnywhereGameLiftAdapter()
    : adapterName === 'queue'
      ? createQueueGameLiftAdapter()
      : createFakeGameLiftAdapter();
  if (!['fake', 'anywhere', 'queue'].includes(adapterName)) throw new Error('GAME_LIFT_ADAPTER must be fake, anywhere, or queue.');
  if (!['memory', 'file'].includes(storeName)) throw new Error('SESSION_API_STORE must be memory or file.');
  const authenticate = authMode === 'cognito'
    ? createCognitoJwtAuthenticator({
      issuer: process.env.COGNITO_ISSUER,
      clientId: process.env.COGNITO_CLIENT_ID,
    })
    : createLocalAuthenticator();
  if (!['local', 'cognito'].includes(authMode)) throw new Error('SESSION_API_AUTH_MODE must be local or cognito.');

  const store = storeName === 'file'
    ? createFileMatchStore({ path: process.env.SESSION_API_STORE_PATH })
    : createInMemoryMatchStore();

  createSessionApi({ adapter, authenticate, store }).listen(port, host, () => {
    console.info(JSON.stringify({ event: 'session_api_started', adapter: adapterName, authMode, store: storeName, host, port }));
  });
}
