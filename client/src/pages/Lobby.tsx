import React, { useEffect, useState } from 'react';
import { socket } from '../socket';

type LeaderboardRow = { username: string; wins: number };

const API_BASE = (import.meta as any).env?.VITE_SOCKET_URL || 'http://localhost:4000';

export default function Lobby({ onStart }: { onStart: (data: any) => void }) {
  const [username, setUsername] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState<number | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [lbError, setLbError] = useState<string | null>(null);

  useEffect(() => {
    function handleMatched(data: any) {
      if (data.waiting) {
        setWaiting(true);
        setWaitSeconds(typeof data.waitSeconds === 'number' ? data.waitSeconds : null);
      } else {
        setWaiting(false);
        setWaitSeconds(null);
        onStart({ gameId: data.gameId, playerNum: data.playerNum, opponent: data.opponent, isBot: data.isBot, username });
        socket.emit('request_game', { gameId: data.gameId });
      }
    }

    socket.on('matched', handleMatched);
    return () => { socket.off('matched', handleMatched); };
  }, [onStart, username]);

  // Client-side countdown effect
  useEffect(() => {
    if (!waiting || waitSeconds === null) return;
    // create interval that decrements waitSeconds every 1s
    const id = setInterval(() => {
      setWaitSeconds(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          // reached zero — stop waiting and clear counter
          setWaiting(false);
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [waiting, waitSeconds]);

    async function fetchLeaderboard(limit = 10) {
    setLbLoading(true);
    setLbError(null);
    try {
      const url = API_BASE ? `${API_BASE}/leaderboard?limit=${limit}` : `/leaderboard?limit=${limit}`;
      const res = await fetch(url, { credentials: 'include' });
      const body = await res.json();
      if (!res.ok || body.ok === false) {
        throw new Error(body.error || `Status ${res.status}`);
      }
      setLeaderboard(body.rows || []);
    } catch (err: any) {
      console.error('Failed to fetch leaderboard', err);
      setLbError(err.message || 'Failed to load leaderboard');
      setLeaderboard([]);
    } finally {
      setLbLoading(false);
    }
  }

   useEffect(() => {
    fetchLeaderboard(10);
  }, []);

  function joinQueue() {
    if (!username) return alert('Enter username');
    socket.emit('join_queue', { username });
  }

  function leaveQueue() {
    socket.emit('leave_queue');
    setWaiting(false);
    setWaitSeconds(null);
  }

  return (
    <div className="lobby">
      <div className="notice">
        The server may take up to 50 seconds to respond on your first request because it’s hosted on a free Render instance that “sleeps” when idle.
        After the first response, everything will run fast and smoothly. Thanks for your patience!
      </div>

      <header className="lobby-header">
        <h1>Connect 4</h1>
        <p className="subtitle">Real-time multiplayer — play online or vs a deterministic bot</p>
      </header>

      <div className="lobby-controls">
        <input className="username" placeholder="Enter a username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <div className="actions">
          <button className="btn primary" onClick={joinQueue}>Join Queue</button>
          <button className="btn" onClick={leaveQueue}>Leave Queue</button>
        </div>
      </div>

      {waiting && <div className="waiting">Waiting for opponent... (auto-bot in {waitSeconds ?? '—'}s)</div>}

      <footer className="lobby-footer">
           <section className="leaderboard">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Leaderboard</h3>
          <div>
            <button className="btn" onClick={() => fetchLeaderboard(10)} disabled={lbLoading}>Refresh</button>
          </div>
        </div>

        {lbLoading && <div>Loading leaderboard…</div>}
        {lbError && <div className="error">Error: {lbError}</div>}

        {!lbLoading && !lbError && leaderboard.length === 0 && <div className="muted">No winners yet — play a game!</div>}

        {!lbLoading && leaderboard.length > 0 && (
          <ol className="leaderboard-list">
            {leaderboard.map((r, i) => (
              <li key={r.username}>
                <strong>{i + 1}. {r.username}</strong> — {r.wins} win{r.wins !== 1 ? 's' : ''}
              </li>
            ))}
          </ol>
        )}
      </section>
      </footer>
    </div>
  );
}
