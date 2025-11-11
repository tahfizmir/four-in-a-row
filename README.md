

This repository contains a TypeScript Node.js server (Express + Socket.IO) and a React + Vite frontend implementing a real-time Connect Four game with matchmaking, a deterministic competitive bot, reconnection handling, and Postgres persistence for completed games.

Features
- Real-time play via Socket.IO. Server is authoritative for all game logic.
- Matchmaking with a 10s wait; auto-match with a deterministic bot if no opponent.
- Bot: immediate win/block, fork detection, then minimax (alpha-beta) depth 4 with heuristic.
- Reconnect within 30s (rejoin event). Forfeit after 30s.
- Leaderboard endpoint and real-time leaderboard_update pushes.

Ports
- Server: 4000
- Frontend: 3000

clone the repo:

Quick start (local)
  Start the server:

   cd server
   npm install
   npm run dev

  Start the client:

   cd client
   npm install
   npm run dev

  Open http://localhost:3000


Live Link: Open the link and make first request by entering username and joining the queue, wait for around 1 minute for the first request as the server is transition from sleep state to active.


