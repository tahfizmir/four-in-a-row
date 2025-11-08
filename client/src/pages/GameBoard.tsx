import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import Board from '../components/Board';

const socket = io('http://localhost:4000');

export default function GameBoard({ initial, onExit }: { initial: any; onExit: () => void }) {
  const [game, setGame] = useState<any>(null);
  const [username, setUsername] = useState('Player');
  const [playerNum, setPlayerNum] = useState<number>(1);

  useEffect(() => {
    socket.on('game_update', (data: any) => setGame(data));
    socket.on('forfeit', (d: any) => alert('Forfeit: ' + JSON.stringify(d)));
    socket.on('opponent_disconnected', (d: any) => console.log('opponent disconnected', d));
    return () => { socket.off('game_update'); socket.off('forfeit'); socket.off('opponent_disconnected'); };
  }, []);

  useEffect(() => {
    if (initial) {
      setPlayerNum(initial.playerNum);
    }
  }, [initial]);

  function playCol(col: number) {
    if (!initial) return;
    socket.emit('play_move', { gameId: initial.gameId, col });
  }

  return (
    <div className="gameboard">
      <div>
        <button onClick={onExit}>Exit</button>
      </div>
      <div>Player: {username} (You are #{playerNum})</div>
      {game && <Board board={game.board} onPlay={playCol} />}
    </div>
  );
}
