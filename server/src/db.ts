import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const mongoDbName = process.env.MONGODB_DB || 'connect4';

let client: MongoClient | null = null;
let db: any = null;

async function connect() {
  if (db) return db;
  // create client and connect
  client = new MongoClient(mongoUrl);
  try {
    console.log('Attempting to connect to MongoDB at', mongoUrl);
    await client.connect();
    db = client.db(mongoDbName);
    console.log('Connected to MongoDB, using DB:', mongoDbName);
    return db;
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    throw err;
  }
}

export async function ensureConnected() {
  try {
    await connect();
    return true;
  } catch (err) {
    return false;
  }
}

export async function saveGameRecord(record: {
  id?: string;
  moves: any;
  winner_username?: string | null;
  loser_username?: string | null;
  is_bot?: boolean;
  result_reason?: string | null;
}) {
  const { id, moves, winner_username, loser_username, is_bot, result_reason } = record;
  const finished_at = new Date();
  try {
    const d = await connect();
    const col = d.collection('games');
    await col.insertOne({
      id: id || undefined,
      created_at: new Date(),
      finished_at,
      moves,
      winner_username: winner_username || null,
      loser_username: loser_username || null,
      is_bot: !!is_bot,
      result_reason: result_reason || null,
    });
    console.log("Game record saved successfully")
  } catch (err) {
    // Log but don't crash the server
    console.error('Failed to save game record to MongoDB:', err);
  }
}

export async function getLeaderboard(limit = 10) {
  try {
    const d = await connect();
    const col = d.collection('games');
    const pipeline = [
      { $match: { winner_username: { $ne: null } } },
      { $group: { _id: '$winner_username', wins: { $sum: 1 } } },
      { $sort: { wins: -1 } },
      { $limit: limit },
      { $project: { _id: 0, username: '$_id', wins: 1 } },
    ];
    const rows = await col.aggregate(pipeline).toArray();
    return rows.map((r: any) => ({ username: r.username, wins: Number(r.wins) }));
  } catch (err) {
    console.error('Failed to query leaderboard from MongoDB:', err);
    return [];
  }
}
