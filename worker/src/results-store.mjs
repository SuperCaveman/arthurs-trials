import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

function emptyState() {
  return { processedEvents: {}, playerXp: {} };
}

export function createInMemoryResultsStore() {
  const state = emptyState();
  return {
    async applyOnce(event) {
      if (state.processedEvents[event.eventId]) return false;
      for (const playerId of event.participants) {
        state.playerXp[playerId] = (state.playerXp[playerId] ?? 0) + event.xpAward;
      }
      state.processedEvents[event.eventId] = {
        matchId: event.matchId,
        completedAt: event.completedAt,
      };
      return true;
    },
    async getXp(playerId) {
      return state.playerXp[playerId] ?? 0;
    },
  };
}

// Development-only durability adapter. Applying every player's reward and the
// event-id receipt in one document, then atomically renaming it, models the
// transaction boundary required of the future PostgreSQL implementation.
// It is intentionally single-process: it has no cross-process lock, backup,
// encryption, or multi-instance coordination.
export function createFileResultsStore({ path }) {
  if (typeof path !== 'string' || path.length === 0) {
    throw new Error('RESULTS_STORE_PATH is required when RESULTS_STORE=file.');
  }

  let state;
  let writeSequence = 0;

  async function load() {
    if (state) return state;
    try {
      const parsed = JSON.parse(await readFile(path, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || typeof parsed.processedEvents !== 'object' || typeof parsed.playerXp !== 'object') {
        throw new Error('Results-store document has an invalid shape.');
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
    async applyOnce(event) {
      const loaded = await load();
      if (loaded.processedEvents[event.eventId]) return false;
      for (const playerId of event.participants) {
        loaded.playerXp[playerId] = (loaded.playerXp[playerId] ?? 0) + event.xpAward;
      }
      loaded.processedEvents[event.eventId] = {
        matchId: event.matchId,
        completedAt: event.completedAt,
      };
      await persist();
      return true;
    },
    async getXp(playerId) {
      return (await load()).playerXp[playerId] ?? 0;
    },
  };
}
