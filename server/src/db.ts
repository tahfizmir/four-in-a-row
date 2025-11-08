import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/connect4';

export const pool = new Pool({ connectionString });

export async function saveGameRecord(record: {
  id?: string;
  moves: any;
  winner_username?: string | null;
  loser_username?: string | null;
  is_bot?: boolean;
  result_reason?: string | null;
}) {
  const { id, moves, winner_username, loser_username, is_bot, result_reason } = record;
  const finished_at = new Date().toISOString();
  await pool.query(
    `INSERT INTO games (id, finished_at, moves, winner_username, loser_username, is_bot, result_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id || null, finished_at, JSON.stringify(moves), winner_username, loser_username, is_bot || false, result_reason]
  );
}

export async function getLeaderboard(limit = 10) {
  // Count wins grouped by winner_username
  const res = await pool.query(
    `SELECT winner_username, COUNT(*) AS wins FROM games WHERE winner_username IS NOT NULL GROUP BY winner_username ORDER BY wins DESC LIMIT $1`,
    [limit]
  );
  return res.rows.map((r) => ({ username: r.winner_username, wins: Number(r.wins) }));
}
