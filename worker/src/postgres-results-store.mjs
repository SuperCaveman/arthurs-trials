import pg from 'pg';

/**
 * Applies an event receipt and all player XP mutations in one database
 * transaction. The receipt's unique event_id is the exactly-once boundary
 * when SQS legitimately re-delivers a message.
 */
export function createPostgresResultsStore({ pool }) {
  if (!pool?.connect) throw new Error('A PostgreSQL pool is required.');

  return {
    async applyOnce(event) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const receipt = await client.query(
          `INSERT INTO match_result_receipts (event_id, match_id, completed_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (event_id) DO NOTHING
           RETURNING event_id`,
          [event.eventId, event.matchId, event.completedAt],
        );
        if (receipt.rowCount === 0) {
          await client.query('ROLLBACK');
          return false;
        }

        for (const playerId of event.participants) {
          await client.query(
            `INSERT INTO player_progression (player_id, total_xp, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (player_id) DO UPDATE
             SET total_xp = player_progression.total_xp + EXCLUDED.total_xp,
                 updated_at = NOW()`,
            [playerId, event.xpAward],
          );
        }
        await client.query('COMMIT');
        return true;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

export function createPostgresPool({ connectionString }) {
  if (!connectionString) throw new Error('RESULTS_DATABASE_URL is required.');
  return new pg.Pool({ connectionString, max: 4, ssl: { rejectUnauthorized: true } });
}
