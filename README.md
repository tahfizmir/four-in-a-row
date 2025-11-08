# Real-time 4-in-a-Row (Connect Four)

This repository contains a TypeScript Node.js server (Express + Socket.IO) and a React + Vite frontend implementing a real-time Connect Four game with matchmaking, a deterministic competitive bot, reconnection handling, and Postgres persistence for completed games.

Features
- Real-time play via Socket.IO. Server is authoritative for all game logic.
- Matchmaking with a 10s wait; auto-match with a deterministic bot if no opponent.
- Bot: immediate win/block, fork detection, then minimax (alpha-beta) depth 4 with heuristic.
- Reconnect within 30s (rejoin event). Forfeit after 30s.
- Persist completed games to Postgres (moves stored as JSONB).
- Leaderboard endpoint and real-time leaderboard_update pushes.

Ports
- Server: 4000
- Frontend: 3000

Quick start (local)

1) Install Postgres and create a database. Or run via Docker (see docker-compose).

2) Create an .env file for the server (see `server/.env.example`).

3) Start the server:

   cd server
   npm install
   npm run dev

4) Start the client:

   cd client
   npm install
   npm run dev

5) Open http://localhost:3000

Database

Run `init.sql` against your Postgres database to create the `games` table.

Docker

Run `docker-compose up --build` to start Postgres, server, and client. Server and client ports are exposed on 4000 and 3000 respectively.

See the project files for more details.
