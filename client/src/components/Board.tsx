import React from 'react';

export default function Board({ board, onPlay, lastMove, playerNum }: { board: number[][]; onPlay: (col: number) => void; lastMove?: any; playerNum?: number }) {
  // board is rows x cols with row 0 bottom
  const rows = board.length || 6;
  const cols = board[0]?.length || 7;

  // find row index for lastMove if available
  const last = lastMove ? { col: lastMove.col, player: lastMove.player } : null;

  return (
    <div className="board">
      <div className="drop-row">
        {Array.from({ length: cols }).map((_, c) => (
          <div key={c} className="drop-cell" onClick={() => onPlay(c)}>
            ▼
          </div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rIdx) => {
        const r = rows - 1 - rIdx; // display top-down
        return (
          <div key={r} className="board-row">
            {Array.from({ length: cols }).map((_, c) => {
              const val = board[r] ? board[r][c] : 0;
              const isLast = last && last.col === c && (() => {
                // find highest filled row in column c (the most recent)
                for (let rr = rows - 1; rr >= 0; rr--) {
                  if (board[rr][c] !== 0) {
                    return board[rr][c] === last.player && rr === r;
                  }
                }
                return false;
              })();
              return (
                <div key={c} className={`cell ${isLast ? 'last' : ''}`} onClick={() => onPlay(c)}>
                  <div className={`disc player-${val}`} />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
