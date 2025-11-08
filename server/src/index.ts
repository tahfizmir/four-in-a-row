import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import { newGame, dropPiece, isWinningMove, isBoardFull, cloneBoard, computeBestMove } from './game';
import { pool, saveGameRecord, getLeaderboard } from './db';
import { GameState } from './types';

dotenv.config();

const PORT = Number(process.env.PORT || 4000);
const QUEUE_WAIT_SECONDS = Number(process.env.QUEUE_WAIT_SECONDS || 10);
const RECONNECT_SECONDS = Number(process.env.RECONNECT_SECONDS || 30);

const app = express();
app.use(cors());
app.use(express.json());

app.get('/leaderboard', async (req, res) => {
  const data = await getLeaderboard(20);
  res.json(data);
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

// In-memory state
const waitingQueue: { socketId: string; username: string; timer?: NodeJS.Timeout }[] = [];
const games = new Map<string, GameState>();
const socketIdToGame = new Map<string, string>();
const reconnectTimers = new Map<string, NodeJS.Timeout>();

function broadcastLeaderboardUpdate() {
  getLeaderboard(10).then((data) => io.emit('leaderboard_update', data)).catch(() => {});
}

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  socket.on('join_queue', ({ username }: { username: string }) => {
    if (!username || typeof username !== 'string') {
      socket.emit('error', { message: 'Invalid username' });
      return;
    }
    // Prevent duplicate in queue
    if (waitingQueue.find((w) => w.socketId === socket.id)) return;

    // Try match immediately
    const other = waitingQueue.shift();
    if (other) {
      // match socket and other
      const game = newGame(socket.id, username);
      // set player 2
      game.players[other.socketId] = { username: other.username, playerNum: 2 };
      game.playerOrder.push(other.socketId);
      games.set(game.id, game);
      socketIdToGame.set(socket.id, game.id);
      socketIdToGame.set(other.socketId, game.id);
      // clear other timer
      if (other.timer) clearTimeout(other.timer);
      io.to(socket.id).emit('matched', { gameId: game.id, playerNum: 1, opponent: other.username });
      io.to(other.socketId).emit('matched', { gameId: game.id, playerNum: 2, opponent: username });
      io.to(game.playerOrder[0]).emit('game_update', game);
      io.to(game.playerOrder[1]).emit('game_update', game);
      return;
    }

    // otherwise add to queue with timer to spawn bot if nobody joins
    const timer = setTimeout(() => {
      // start vs bot
      const game = newGame(socket.id, username, true);
      // create a pseudo-socket id for bot
      const botSocketId = `bot-${game.id}`;
      game.players[botSocketId] = { username: 'BOT', playerNum: 2 };
      game.playerOrder.push(botSocketId);
      games.set(game.id, game);
      socketIdToGame.set(socket.id, game.id);
      // notify player
      io.to(socket.id).emit('matched', { gameId: game.id, playerNum: 1, opponent: 'BOT', isBot: true });
      io.to(socket.id).emit('game_update', game);
      // remove from waitingQueue already handled by shift
    }, QUEUE_WAIT_SECONDS * 1000);

    waitingQueue.push({ socketId: socket.id, username, timer });
    // notify client of waiting state
    socket.emit('matched', { waiting: true, waitSeconds: QUEUE_WAIT_SECONDS });
  });

  socket.on('leave_queue', () => {
    const idx = waitingQueue.findIndex((w) => w.socketId === socket.id);
    if (idx >= 0) {
      const w = waitingQueue.splice(idx, 1)[0];
      if (w.timer) clearTimeout(w.timer);
    }
  });

  socket.on('play_move', async ({ gameId, col }: { gameId: string; col: number }) => {
    try {
      const game = games.get(gameId);
      if (!game) return socket.emit('error', { message: 'Game not found' });
      if (game.finished) return socket.emit('error', { message: 'Game already finished' });
      const playerInfo = game.players[socket.id];
      if (!playerInfo) return socket.emit('error', { message: 'Not part of game' });
      const expectedPlayerNum = game.turn;
      if (playerInfo.playerNum !== expectedPlayerNum) return socket.emit('error', { message: 'Not your turn' });
      // drop
      const row = dropPiece(game.board, col, playerInfo.playerNum);
      if (row < 0) return socket.emit('error', { message: 'Invalid move' });
      game.moves.push({ col, player: playerInfo.playerNum, username: playerInfo.username, at: new Date().toISOString() });
      // check win
      if (isWinningMove(game.board, row, col, playerInfo.playerNum)) {
        game.finished = true;
        game.winnerUsername = playerInfo.username;
        // find loser
        const otherSocketId = game.playerOrder.find((id) => id !== socket.id)!;
        const other = game.players[otherSocketId];
        game.loserUsername = other ? other.username : null;
        games.delete(gameId);
        socketIdToGame.delete(socket.id);
        if (otherSocketId.startsWith('bot-')) {
          // vs bot
          await saveGameRecord({ id: game.id, moves: game.moves, winner_username: game.winnerUsername, loser_username: game.loserUsername, is_bot: true, result_reason: 'normal' });
        } else {
          await saveGameRecord({ id: game.id, moves: game.moves, winner_username: game.winnerUsername, loser_username: game.loserUsername, is_bot: false, result_reason: 'normal' });
        }
        io.to(game.playerOrder[0]).emit('game_update', game);
        io.to(game.playerOrder[1]).emit('game_update', game);
        broadcastLeaderboardUpdate();
        return;
      }
      // check draw
      if (isBoardFull(game.board)) {
        game.finished = true;
        game.winnerUsername = null;
        game.loserUsername = null;
        games.delete(gameId);
        socketIdToGame.delete(socket.id);
        await saveGameRecord({ id: game.id, moves: game.moves, winner_username: null, loser_username: null, is_bot: !!game.isBot, result_reason: 'draw' });
        io.to(game.playerOrder[0]).emit('game_update', game);
        io.to(game.playerOrder[1]).emit('game_update', game);
        broadcastLeaderboardUpdate();
        return;
      }

      // switch turn
      game.turn = game.turn === 1 ? 2 : 1;
      io.to(game.playerOrder[0]).emit('game_update', game);
      io.to(game.playerOrder[1]).emit('game_update', game);

      // If opponent is bot, compute and play synchronously
      const otherSocketId = game.playerOrder.find((id) => id !== socket.id)!;
      if (otherSocketId.startsWith('bot-')) {
        // compute bot move
        const botPlayerNum = game.players[otherSocketId].playerNum;
        const colBot = computeBestMove(cloneBoard(game.board), botPlayerNum);
        const rowBot = dropPiece(game.board, colBot, botPlayerNum);
        if (rowBot >= 0) {
          game.moves.push({ col: colBot, player: botPlayerNum, username: 'BOT', at: new Date().toISOString() });
          if (isWinningMove(game.board, rowBot, colBot, botPlayerNum)) {
            game.finished = true;
            game.winnerUsername = 'BOT';
            game.loserUsername = game.players[socket.id].username;
            games.delete(gameId);
            socketIdToGame.delete(socket.id);
            await saveGameRecord({ id: game.id, moves: game.moves, winner_username: game.winnerUsername, loser_username: game.loserUsername, is_bot: true, result_reason: 'normal' });
            io.to(socket.id).emit('game_update', game);
            broadcastLeaderboardUpdate();
            return;
          }
          // check draw
          if (isBoardFull(game.board)) {
            game.finished = true;
            game.winnerUsername = null;
            game.loserUsername = null;
            games.delete(gameId);
            socketIdToGame.delete(socket.id);
            await saveGameRecord({ id: game.id, moves: game.moves, winner_username: null, loser_username: null, is_bot: true, result_reason: 'draw' });
            io.to(socket.id).emit('game_update', game);
            broadcastLeaderboardUpdate();
            return;
          }
          // Switch back to player
          game.turn = game.turn === 1 ? 2 : 1;
          io.to(socket.id).emit('game_update', game);
        }
      }
    } catch (err) {
      console.error(err);
      socket.emit('error', { message: 'Server error' });
    }
  });

  socket.on('rejoin', ({ username, gameId }: { username: string; gameId: string }) => {
    const game = games.get(gameId);
    if (!game) return socket.emit('error', { message: 'Game not found or already finished' });
    // find the player's previous socket
    const prevEntry = Object.entries(game.players).find(([, val]) => val.username === username && !String(val.playerNum).startsWith('bot'));
    if (!prevEntry) return socket.emit('error', { message: 'Player not found in game' });
    const [prevSocketId, info] = prevEntry as [string, any];
    // replace socket id
    delete game.players[prevSocketId];
    game.players[socket.id] = { username, playerNum: info.playerNum };
    // update playerOrder
    const idx = game.playerOrder.indexOf(prevSocketId);
    if (idx >= 0) game.playerOrder[idx] = socket.id;
    socketIdToGame.set(socket.id, gameId);
    // clear possible reconnect timer
    if (reconnectTimers.has(gameId)) {
      clearTimeout(reconnectTimers.get(gameId)!);
      reconnectTimers.delete(gameId);
    }
    io.to(socket.id).emit('game_update', game);
    // notify opponent
    const otherSocketId = game.playerOrder.find((id) => id !== socket.id)!;
    if (otherSocketId && !otherSocketId.startsWith('bot-')) {
      io.to(otherSocketId).emit('game_update', game);
    }
  });

  socket.on('disconnect', () => {
    console.log('socket disconnect', socket.id);
    // If player in waitingQueue, remove
    const wIdx = waitingQueue.findIndex((w) => w.socketId === socket.id);
    if (wIdx >= 0) {
      const w = waitingQueue.splice(wIdx, 1)[0];
      if (w.timer) clearTimeout(w.timer);
    }

    const gameId = socketIdToGame.get(socket.id);
    if (!gameId) return;
    const game = games.get(gameId);
    if (!game) return;
    // start reconnect timer
    const otherSocketId = game.playerOrder.find((id) => id !== socket.id)!;
    let remaining = RECONNECT_SECONDS;
    io.to(otherSocketId).emit('opponent_disconnected', { seconds: remaining });
    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) io.to(otherSocketId).emit('opponent_disconnected', { seconds: remaining });
    }, 1000);
    const t = setTimeout(async () => {
      clearInterval(interval);
      // forfeit
      game.finished = true;
      const disconnectedPlayer = game.players[socket.id];
      const winnerInfo = game.players[otherSocketId];
      game.winnerUsername = winnerInfo ? winnerInfo.username : null;
      game.loserUsername = disconnectedPlayer ? disconnectedPlayer.username : null;
      games.delete(gameId);
      socketIdToGame.delete(socket.id);
      socketIdToGame.delete(otherSocketId);
      await saveGameRecord({ id: game.id, moves: game.moves, winner_username: game.winnerUsername, loser_username: game.loserUsername, is_bot: !!game.isBot, result_reason: 'forfeit' });
      io.to(otherSocketId).emit('forfeit', { winner: game.winnerUsername });
      broadcastLeaderboardUpdate();
    }, RECONNECT_SECONDS * 1000);
    reconnectTimers.set(gameId, t);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
