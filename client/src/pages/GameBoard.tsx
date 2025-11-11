import React, { useEffect, useState } from 'react';
import { socket } from '../socket';
import Board from '../components/Board';
import '../styles.css';

// const socket = io('http://localhost:4000');

export default function GameBoard({ initial, onExit }: { initial: any; onExit: () => void }) {
  const [game, setGame] = useState<any>(null);
  const [username, setUsername] = useState<string | null>(initial?.username ?? null);
  const [playerNum, setPlayerNum] = useState<number>(initial?.playerNum ?? 1);
  const [opponentDisconnectedSecs, setOpponentDisconnectedSecs] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    socket.on('game_update', (data: any) => {
      setGame(data);
      if (data.finished) setShowResult(true);
    });
    socket.on('forfeit', (d: any) => {
      // show result modal
      setShowResult(true);
    });
    socket.on('opponent_disconnected', (d: any) => {
      if (d && typeof d.seconds === 'number') setOpponentDisconnectedSecs(d.seconds);
    });
    return () => { socket.off('game_update'); socket.off('forfeit'); socket.off('opponent_disconnected'); };
  }, []);

  useEffect(() => {
    if (initial) {
      setPlayerNum(initial.playerNum);
      setUsername(initial.username ?? username);
      // request current game state in case it was emitted before this component mounted
      if (initial.gameId) socket.emit('request_game', { gameId: initial.gameId });
    }
  }, [initial]);


  function playCol(col: number) {
    if (!initial || !game) return;
    // only allow play if it's this player's turn
    if (game.turn !== playerNum) return;
    socket.emit('play_move', { gameId: initial.gameId, col });
  }

  function rejoin() {
    if (!initial || !username) return;
    socket.emit('rejoin', { username, gameId: initial.gameId });
  }

  const lastMove = game?.moves?.length ? game.moves[game.moves.length - 1] : null;

  return (
    <div className="game-wrap">
      <header className="game-header">
        <h2>Connect 4</h2>
        <div>
          <span className="player-label">You: <strong>{username}</strong> (#{playerNum})</span>
          <button className="exit-btn" onClick={onExit}>Exit</button>
        </div>
      </header>

      <main className="game-main">
        <aside className="panel">
          <h3>Match</h3>
          <div>Game ID: <code>{initial?.gameId}</code></div>
          <div>Turn: {game ? `Player ${game.turn}` : '—'}</div>
          <div>Opponent: {game ? Object.values(game.players).find((p: any) => p.playerNum !== playerNum)?.username ?? 'BOT' : '—'}</div>
          {opponentDisconnectedSecs !== null && (
            <div className="warning">Opponent disconnected — {opponentDisconnectedSecs}s</div>
          )}
          <div style={{ marginTop: 12 }}>
            <button onClick={rejoin}>Rejoin</button>
          </div>
        </aside>

        <section className="board-area">
          {game ? (
            <>
              <div className="turn-info">Current turn: Player {game.turn}</div>
              <Board board={game.board} onPlay={playCol} lastMove={lastMove} playerNum={playerNum} />
            </>
          ) : (
            <div className="placeholder">Waiting for game...</div>
          )}
        </section>
      </main>

      {showResult && game && (
        <div className="modal">
          <div className="modal-content">
            <h3>Game Over</h3>
            {game.winnerUsername ? (
              <div>{game.winnerUsername} wins!</div>
            ) : (
              <div>Draw</div>
            )}
            <div style={{ marginTop: 12 }}>
              <button onClick={() => { setShowResult(false); onExit(); }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
