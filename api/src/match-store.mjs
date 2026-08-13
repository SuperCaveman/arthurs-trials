import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

function emptyState() {
  return { matches: {}, idempotency: {} };
}

function idempotencyKey(ownerId, key) {
  return `${ownerId}:${key}`;
}

export function createInMemoryMatchStore() {
  const state = emptyState();
  return {
    async getById(matchRequestId) {
      return state.matches[matchRequestId] ?? null;
    },
    async getByIdempotency(ownerId, key) {
      const matchRequestId = state.idempotency[idempotencyKey(ownerId, key)];
      return matchRequestId ? state.matches[matchRequestId] ?? null : null;
    },
    async save(match, key) {
      state.matches[match.matchRequestId] = match;
      state.idempotency[idempotencyKey(match.ownerId, key)] = match.matchRequestId;
    },
  };
}

// A deliberately small, single-process development persistence adapter. The
// temporary-file rename prevents a half-written record after a local crash;
// it is not a substitute for PostgreSQL transactions or multi-instance locks.
export function createFileMatchStore({ path }) {
  if (typeof path !== 'string' || path.length === 0) {
    throw new Error('SESSION_API_STORE_PATH is required when SESSION_API_STORE=file.');
  }

  let state;
  let writeSequence = 0;

  async function load() {
    if (state) return state;
    try {
      const parsed = JSON.parse(await readFile(path, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || typeof parsed.matches !== 'object' || typeof parsed.idempotency !== 'object') {
        throw new Error('Session-store document has an invalid shape.');
      }
      state = parsed;
    } catch (error) {
      if (error.code === 'ENOENT') {
        state = emptyState();
      } else {
        throw error;
      }
    }
    return state;
  }

  async function persist() {
    await mkdir(dirname(path), { recursive: true });
    const temporaryPath = `${path}.${process.pid}.${writeSequence += 1}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temporaryPath, path);
  }

  return {
    async getById(matchRequestId) {
      return (await load()).matches[matchRequestId] ?? null;
    },
    async getByIdempotency(ownerId, key) {
      const loaded = await load();
      const matchRequestId = loaded.idempotency[idempotencyKey(ownerId, key)];
      return matchRequestId ? loaded.matches[matchRequestId] ?? null : null;
    },
    async save(match, key) {
      const loaded = await load();
      loaded.matches[match.matchRequestId] = match;
      loaded.idempotency[idempotencyKey(match.ownerId, key)] = match.matchRequestId;
      await persist();
    },
  };
}
