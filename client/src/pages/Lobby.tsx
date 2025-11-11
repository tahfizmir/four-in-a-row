import React, { useEffect, useState } from 'react';
import { socket } from '../socket';

export default function Lobby({ onStart }: { onStart: (data: any) => void }) {
  const [username, setUsername] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState<number | null>(null);

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
        <a className="link" href="/leaderboard.html">View Leaderboard</a>
      </footer>
    </div>
  );
}
