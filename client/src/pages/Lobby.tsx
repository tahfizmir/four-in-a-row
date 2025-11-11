import React, { useEffect, useState } from 'react';
import { socket } from '../socket';

export default function Lobby({ onStart }: { onStart: (data: any) => void }) {
  const [username, setUsername] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState<number | null>(null);

  useEffect(() => {
    socket.on('matched', (data: any) => {
      if (data.waiting) {
        setWaiting(true);
        setWaitSeconds(data.waitSeconds);
      } else {
        setWaiting(false);
        // Request the full game state from server after we get matched. GameBoard will also request on mount.
        // Pass minimal initial info to navigate immediately.
        onStart({ gameId: data.gameId, playerNum: data.playerNum, opponent: data.opponent, isBot: data.isBot, username });
        // ask server to send the current game state to this socket
        socket.emit('request_game', { gameId: data.gameId });
      }
    });
    return () => { socket.off('matched'); };
  }, []);

  function joinQueue() {
    if (!username) return alert('Enter username');
    socket.emit('join_queue', { username });
  }

  function leaveQueue() {
    socket.emit('leave_queue');
    setWaiting(false);
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

      {waiting && <div className="waiting">Waiting for opponent... (auto-bot in {waitSeconds}s)</div>}

      <footer className="lobby-footer">
        <a className="link" href="/leaderboard.html">View Leaderboard</a>
      </footer>
    </div>
  );
}
