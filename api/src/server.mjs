import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const MAX_BODY_BYTES = 16 * 1024;
const MAX_PARTY_SIZE = 4;
const LOCAL_TOKEN_PATTERN = /^Bearer local-dev-([A-Za-z0-9._-]{3,64})$/;
const GAME_SESSION_READY_TIMEOUT_MS = 20_000;

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
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

function requireLocalPrincipal(request) {
  const match = LOCAL_TOKEN_PATTERN.exec(request.headers.authorization ?? '');
  if (!match) {
    const error = new Error('A local development bearer token is required.');
    error.statusCode = 401;
    throw error;
  }
  return { id: match[1] };
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
    throw new Error(`${name} is required when GAME_LIFT_ADAPTER=anywhere.`);
  }
  return value;
}

async function awsJson(args) {
  const { stdout } = await execFileAsync('aws', args, { windowsHide: true });
  return JSON.parse(stdout);
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

export function createSessionApi({ adapter = createFakeGameLiftAdapter(), logger = console } = {}) {
  const matches = new Map();
  const idempotency = new Map();

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');

      // Intended for container/orchestrator health checks. It exposes no
      // match or player data and does not require a player credential.
      if (request.method === 'GET' && url.pathname === '/healthz') {
        return sendJson(response, 200, { status: 'ok', service: 'session-api' });
      }

      const principal = requireLocalPrincipal(request);

      if (request.method === 'POST' && url.pathname === '/v1/matches') {
        const idempotencyKey = request.headers['idempotency-key'];
        if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9-]{16,128}$/.test(idempotencyKey)) {
          return sendJson(response, 400, { error: 'A UUID-shaped Idempotency-Key is required.' });
        }

        const existingId = idempotency.get(`${principal.id}:${idempotencyKey}`);
        if (existingId) {
          return sendJson(response, 200, publicMatch(matches.get(existingId)));
        }

        const body = await readJson(request);
        validateMatchRequest(body, principal);
        const matchRequestId = `mrq_${randomUUID()}`;
        const connection = await adapter.createMatch({
          playerId: principal.id,
          maximumPlayerSessions: MAX_PARTY_SIZE,
          matchRequestId,
          party: body.party,
          xpAward: 125,
        });
        const match = {
          matchRequestId,
          status: 'READY',
          connection,
          expiresAt: connection.expiresAt,
          ownerId: principal.id,
        };
        matches.set(match.matchRequestId, match);
        idempotency.set(`${principal.id}:${idempotencyKey}`, match.matchRequestId);
        logger.info?.({ event: 'match_ready', matchRequestId: match.matchRequestId, playerId: principal.id });
        return sendJson(response, 201, publicMatch(match));
      }

      const matchId = /^\/v1\/matches\/(mrq_[A-Za-z0-9-]+)$/.exec(url.pathname)?.[1];
      if (matchId && request.method === 'GET') {
        const match = matches.get(matchId);
        if (!match) return sendJson(response, 404, { error: 'Match request was not found.' });
        if (match.ownerId !== principal.id) return sendJson(response, 403, { error: 'Match request belongs to another player.' });
        return sendJson(response, 200, publicMatch(match));
      }

      if (matchId && request.method === 'DELETE') {
        const match = matches.get(matchId);
        if (!match) return sendJson(response, 404, { error: 'Match request was not found.' });
        if (match.ownerId !== principal.id) return sendJson(response, 403, { error: 'Match request belongs to another player.' });
        return sendJson(response, 409, { error: 'READY local matches cannot be cancelled after a player session is issued.' });
      }

      return sendJson(response, 404, { error: 'Route was not found.' });
    } catch (error) {
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
  const adapter = adapterName === 'anywhere'
    ? createAnywhereGameLiftAdapter()
    : createFakeGameLiftAdapter();
  if (!['fake', 'anywhere'].includes(adapterName)) throw new Error('GAME_LIFT_ADAPTER must be fake or anywhere.');

  createSessionApi({ adapter }).listen(port, host, () => {
    console.info(JSON.stringify({ event: 'session_api_started', adapter: adapterName, host, port }));
  });
}
