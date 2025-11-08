export type Cell = 0 | 1 | 2; // 0 empty, 1 player1, 2 player2

export interface GameState {
  id: string;
  players: { [socketId: string]: { username: string; playerNum: 1 | 2 } };
  playerOrder: string[]; // socketIds order: player1 socketId then player2
  board: Cell[][]; // 6 rows x 7 cols; board[row][col], row 0 is bottom
  turn: 1 | 2;
  moves: { col: number; player: number; username: string; at: string }[];
  finished?: boolean;
  winnerUsername?: string | null;
  loserUsername?: string | null;
  isBot?: boolean;
  createdAt: string;
}
