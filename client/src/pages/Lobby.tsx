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
      <h1>Connect 4</h1>
      <div>
        <input placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <button onClick={joinQueue}>Join Queue</button>
        <button onClick={leaveQueue}>Leave Queue</button>
      </div>
      {waiting && <div>Waiting for opponent... (auto-bot in {waitSeconds}s)</div>}
      <div style={{ marginTop: 20 }}>
        <a href="/leaderboard.html">Leaderboard</a>
      </div>
    </div>
  );
}
