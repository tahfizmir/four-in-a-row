import { GameState, Cell } from './types';
import { v4 as uuidv4 } from 'uuid';

// Board constants
export const COLS = 7;
export const ROWS = 6;

export function createEmptyBoard(): Cell[][] {
  // row 0 is bottom row
  const b: Cell[][] = [];
  for (let r = 0; r < ROWS; r++) {
    b.push(new Array(COLS).fill(0) as Cell[]);
  }
  return b;
}

export function newGame(playerSocketId: string, username: string, isBot = false): GameState {
  const id = uuidv4();
  const players: { [k: string]: { username: string; playerNum: 1 | 2 } } = {};
  players[playerSocketId] = { username, playerNum: 1 };
  return {
    id,
    players,
    playerOrder: [playerSocketId],
    board: createEmptyBoard(),
    turn: 1,
    moves: [],
    finished: false,
    isBot,
    createdAt: new Date().toISOString(),
  };
}

// Drop a piece into a column. Returns row index or -1 if invalid.
export function dropPiece(board: Cell[][], col: number, player: 1 | 2): number {
  if (col < 0 || col >= COLS) return -1;
  for (let r = 0; r < ROWS; r++) {
    if (board[r][col] === 0) {
      board[r][col] = player as Cell;
      return r;
    }
  }
  return -1; // column full
}

export function isWinningMove(board: Cell[][], row: number, col: number, player: 1 | 2): boolean {
  const dir = [
    { dr: 0, dc: 1 },
    { dr: 1, dc: 0 },
    { dr: 1, dc: 1 },
    { dr: 1, dc: -1 },
  ];
  for (const d of dir) {
    let count = 1;
    for (let s = 1; s < 4; s++) {
      const r = row + d.dr * s;
      const c = col + d.dc * s;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) break;
      if (board[r][c] === player) count++; else break;
    }
    for (let s = 1; s < 4; s++) {
      const r = row - d.dr * s;
      const c = col - d.dc * s;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) break;
      if (board[r][c] === player) count++; else break;
    }
    if (count >= 4) return true;
  }
  return false;
}

export function isBoardFull(board: Cell[][]) {
  for (let c = 0; c < COLS; c++) {
    if (board[ROWS - 1][c] === 0) return false;
  }
  return true;
}

// Clone board
export function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((r) => r.slice() as Cell[]);
}

/*
  Bot logic:
  1) If bot can win immediately, play that move
  2) Else if opponent can win next turn, block
  3) Else prefer moves that create forks (two threats) — try 2-step lookahead
  4) Else minimax with alpha-beta depth 4 and heuristic

  Heuristic values and depth can be tuned here.
*/

// Evaluate heuristic for board for player (1 or 2)
export function heuristic(board: Cell[][], player: 1 | 2): number {
  const opponent = player === 1 ? 2 : 1;
  let score = 0;

  // center preference
  const centerCol = Math.floor(COLS / 2);
  for (let r = 0; r < ROWS; r++) {
    if (board[r][centerCol] === player) score += 6;
  }

  // count windows of length 4
  function evaluateWindow(window: Cell[]) {
    const pCount = window.filter((x) => x === player).length;
    const oCount = window.filter((x) => x === opponent).length;
    if (pCount === 4) return 10000;
    if (pCount === 3 && oCount === 0) return 1000;
    if (pCount === 2 && oCount === 0) return 100;
    if (oCount === 3 && pCount === 0) return -900; // block
    return 0;
  }

  // horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const w = [board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]];
      score += evaluateWindow(w);
    }
  }
  // vertical
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      const w = [board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]];
      score += evaluateWindow(w);
    }
  }
  // diag
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const w = [board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]];
      score += evaluateWindow(w);
    }
  }
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const w = [board[r][c], board[r - 1][c + 1], board[r - 2][c + 2], board[r - 3][c + 3]];
      score += evaluateWindow(w);
    }
  }

  return score;
}

// Return list of valid columns
export function validMoves(board: Cell[][]): number[] {
  const moves: number[] = [];
  for (let c = 0; c < COLS; c++) {
    if (board[ROWS - 1][c] === 0) moves.push(c);
  }
  return moves;
}

// Find first available row for col, or -1
export function firstAvailableRow(board: Cell[][], col: number): number {
  for (let r = 0; r < ROWS; r++) if (board[r][col] === 0) return r;
  return -1;
}

// Count immediate winning moves for player
export function immediateWinningMoves(board: Cell[][], player: 1 | 2): number[] {
  const res: number[] = [];
  for (const c of validMoves(board)) {
    const b = cloneBoard(board);
    const r = dropPiece(b, c, player);
    if (r >= 0 && isWinningMove(b, r, c, player)) res.push(c);
  }
  return res;
}

// Check forks: moves that create at least two immediate winning moves next turn
export function forkMoves(board: Cell[][], player: 1 | 2): number[] {
  const res: number[] = [];
  for (const c of validMoves(board)) {
    const b = cloneBoard(board);
    const r = dropPiece(b, c, player);
    if (r < 0) continue;
    const wins = immediateWinningMoves(b, player).length;
    if (wins >= 2) res.push(c);
  }
  return res;
}

// Minimax with alpha-beta
export function minimax(board: Cell[][], depth: number, alpha: number, beta: number, maximizingPlayer: boolean, player: 1 | 2): { score: number; col: number | null } {
  const valid = validMoves(board);
  const opponent = player === 1 ? 2 : 1;

  // terminal checks
  const playerWins = immediateWinningMoves(board, player).length > 0;
  const oppWins = immediateWinningMoves(board, opponent).length > 0;
  if (depth === 0 || valid.length === 0 || playerWins || oppWins) {
    const sc = heuristic(board, player);
    return { score: sc, col: null };
  }

  if (maximizingPlayer) {
    let value = -Infinity;
    let bestCol = valid[0];
    for (const col of valid) {
      const b = cloneBoard(board);
      const r = dropPiece(b, col, player);
      if (r < 0) continue;
      if (isWinningMove(b, r, col, player)) return { score: 100000, col };
      const next = minimax(b, depth - 1, alpha, beta, false, player);
      if (next.score > value || (next.score === value && col < (bestCol ?? 999))) {
        value = next.score;
        bestCol = col;
      }
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return { score: value, col: bestCol };
  } else {
    // minimizing: opponent moves
    let value = Infinity;
    let bestCol = valid[0];
    for (const col of valid) {
      const b = cloneBoard(board);
      const r = dropPiece(b, col, opponent);
      if (r < 0) continue;
      if (isWinningMove(b, r, col, opponent)) return { score: -100000, col };
      const next = minimax(b, depth - 1, alpha, beta, true, player);
      if (next.score < value || (next.score === value && col < (bestCol ?? 999))) {
        value = next.score;
        bestCol = col;
      }
      beta = Math.min(beta, value);
      if (alpha >= beta) break;
    }
    return { score: value, col: bestCol };
  }
}

export function computeBestMove(board: Cell[][], botPlayer: 1 | 2): number {
  // 1) immediate win
  const winMoves = immediateWinningMoves(board, botPlayer);
  if (winMoves.length > 0) return Math.min(...winMoves);

  const opponent = botPlayer === 1 ? 2 : 1;
  // 2) block opponent immediate win
  const oppWins = immediateWinningMoves(board, opponent);
  if (oppWins.length > 0) return Math.min(...oppWins);

  // 3) fork moves
  const forks = forkMoves(board, botPlayer);
  if (forks.length > 0) return Math.min(...forks);

  // 4) minimax depth 4
  const result = minimax(board, 4, -Infinity, Infinity, true, botPlayer);
  if (result.col !== null) return result.col;

  // fallback: choose lowest valid col (deterministic)
  const valids = validMoves(board);
  return valids.length > 0 ? Math.min(...valids) : 0;
}
