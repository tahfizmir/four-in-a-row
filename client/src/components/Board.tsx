import React from 'react';

export default function Board({ board, onPlay }: { board: number[][]; onPlay: (col: number) => void }) {
  // board is rows x cols with row 0 bottom
  const rows = 6;
  const cols = 7;
  return (
    <div className="board">
      {Array.from({ length: rows }).map((_, rIdx) => {
        const r = rows - 1 - rIdx; // display top-down
        return (
          <div key={r} className="board-row">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="cell" onClick={() => onPlay(c)}>
                <div className={`disc player-${board[r][c]}`} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
