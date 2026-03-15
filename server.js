'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { fillFood, createPlayer, recordScore, tickPlayers, computeTickMs } = require('./game');
const db = require('./db');

// ─── Config ──────────────────────────────────────────────────────────────────
const PORT      = process.env.PORT || 3000;
const GRID_SIZE = 25;
const MAX_FOOD  = 5;
const TOP_N     = 10;

const PLAYER_COLORS = [
  '#00e5ff', '#ff4081', '#76ff03', '#ffea00',
  '#ff6d00', '#d500f9', '#1de9b6', '#ff1744',
];

// ─── Leaderboard (in-memory, synced from DB on start) ────────────────────────
let leaderboard = [];

// ─── HTTP server (serves index.html) ─────────────────────────────────────────
const httpServer = http.createServer((req, res) => {
  if (req.url === '/leaderboard' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(leaderboard));
    return;
  }
  const filePath = path.join(__dirname, 'index.html');
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(data);
  });
});

// ─── Game state ───────────────────────────────────────────────────────────────
const players = new Map();
const food    = [];
let nextId         = 1;
let gameLoopTimer  = null;
let currentTickMs  = 200;   // starts slow, speeds up as food is eaten
let totalFoodEaten = 0;

function snakes() { return [...players.values()].map(p => p.snake); }

// ─── Game loop ────────────────────────────────────────────────────────────────
function tick() {
  const playerList = [...players.values()];
  if (!playerList.some(p => p.alive)) return;

  const { newlyDead, foodEaten } = tickPlayers(playerList, food, GRID_SIZE, MAX_FOOD);

  // Persist deaths and refresh leaderboard
  const deathsWithScore = newlyDead.filter(p => p.score > 0);
  if (deathsWithScore.length > 0) {
    let updated = false;
    for (const p of deathsWithScore) {
      if (db.connected()) {
        db.insertScore(p.name, p.score);
        leaderboard = db.getTopScores(TOP_N);
        updated = true;
      } else {
        const { leaderboard: next, updated: changed } = recordScore(leaderboard, p.name, p.score, TOP_N);
        if (changed) { leaderboard = next; updated = true; }
      }
    }
    if (updated) broadcast({ type: 'leaderboard', entries: leaderboard });
  }

  // Speed up when food is eaten
  if (foodEaten > 0) {
    totalFoodEaten += foodEaten;
    const nextTickMs = computeTickMs(totalFoodEaten);
    if (nextTickMs !== currentTickMs) {
      currentTickMs = nextTickMs;
      restartLoop();  // reschedule with new interval
    }
  }

  broadcast({ type: 'state', players: serializePlayers(), food, tickMs: currentTickMs });
}

function serializePlayers() {
  return [...players.values()].map(p => ({
    id: p.id, name: p.name, color: p.color,
    snake: p.snake, score: p.score, alive: p.alive,
  }));
}

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const p of players.values()) {
    if (p.ws && p.ws.readyState === 1) p.ws.send(data);
  }
}

function startLoop() {
  if (!gameLoopTimer) gameLoopTimer = setInterval(tick, currentTickMs);
}

function restartLoop() {
  if (gameLoopTimer) { clearInterval(gameLoopTimer); gameLoopTimer = null; }
  gameLoopTimer = setInterval(tick, currentTickMs);
}

function stopLoop() {
  if (gameLoopTimer) { clearInterval(gameLoopTimer); gameLoopTimer = null; }
  totalFoodEaten = 0;
  currentTickMs  = 200;
}

// ─── WebSocket server ─────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  const id    = nextId++;
  const color = PLAYER_COLORS[(id - 1) % PLAYER_COLORS.length];
  const player = createPlayer(id, color, GRID_SIZE, snakes());
  player.ws = ws;
  players.set(id, player);

  fillFood(food, snakes(), MAX_FOOD, GRID_SIZE);
  startLoop();

  ws.send(JSON.stringify({
    type: 'init',
    playerId: id,
    gridSize: GRID_SIZE,
    players: serializePlayers(),
    food,
    leaderboard,
  }));

  broadcast({ type: 'joined', player: { id, name: player.name, color } });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'direction') {
      const dir  = msg.direction;
      const curr = player.direction;
      if (dir.x !== -curr.x || dir.y !== -curr.y) player.nextDir = dir;
    }

    if (msg.type === 'rename') {
      const name = String(msg.name).trim().slice(0, 20);
      if (name) { player.name = name; broadcast({ type: 'rename', id, name }); }
    }

    if (msg.type === 'respawn' && !player.alive) {
      const fresh = createPlayer(id, color, GRID_SIZE, snakes());
      player.snake     = fresh.snake;
      player.direction = fresh.direction;
      player.nextDir   = fresh.nextDir;
      player.score     = 0;
      player.alive     = true;
      broadcast({ type: 'state', players: serializePlayers(), food });
    }
  });

  ws.on('close', () => {
    players.delete(id);
    broadcast({ type: 'left', id });
    if (players.size === 0) stopLoop();
  });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
db.init();
leaderboard = db.getTopScores(TOP_N);

httpServer.listen(PORT, () => {
  console.log(`Snake game running at http://localhost:${PORT}`);
});
