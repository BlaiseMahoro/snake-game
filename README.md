# Multiplayer Snake Game

A real-time multiplayer Snake game playable in any browser. Multiple players connect simultaneously, each controlling their own snake on a shared board.

## Features

- Real-time multiplayer via WebSockets — see all snakes move live
- Gradual speed increase as food is eaten
- Persistent all-time top-10 leaderboard (saved to disk)
- Name entry before the game starts
- Mobile swipe support
- Respawn after death
- Dockerised for easy deployment

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) v18 or higher

### Run locally

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) in as many browser tabs or devices as you like — each one becomes a new player.

### Run with Docker

```bash
docker build -t snake-game .

# Scores persist across restarts via a named volume
docker run -p 3000:3000 -v snake_scores:/app/scores.json snake-game
```

## Controls

| Key | Direction |
|-----|-----------|
| `W` / `Arrow Up` | Up |
| `S` / `Arrow Down` | Down |
| `A` / `Arrow Left` | Left |
| `D` / `Arrow Right` | Right |

On mobile, swipe on the game board.

## How to Play

1. Open the game URL in your browser
2. Enter your name and click **Play**
3. Eat the pink food pellets to grow and score points (+10 per pellet)
4. Avoid running into other snakes or yourself
5. The game speeds up as more food is eaten
6. Click **Play Again** to respawn after dying

## Architecture

```
server.js   — Node.js HTTP + WebSocket server, game loop
game.js     — Pure game logic (movement, collision, scoring)
index.html  — Browser client (Canvas renderer + WebSocket client)
scores.json — Persistent leaderboard (created at runtime, gitignored)
```

The server runs a central game loop and broadcasts state to all connected clients. Players send only their direction inputs; the server is authoritative for all game state.

## Testing

```bash
npm test
```

48 unit tests covering all game logic: movement, wall wrapping, food eating, collision detection, leaderboard scoring, and speed calculation.

## Deployment

The app is deployed on [Render.com](https://render.com). To deploy your own instance:

1. Push this repo to GitHub
2. Create a new **Web Service** on Render, connected to the repo
3. Set **Build Command** to `npm install` and **Start Command** to `node server.js`
4. Deploy — Render provides a public URL with WebSocket support

> **Note:** Render's free tier has an ephemeral filesystem, so `scores.json` resets on each redeploy.
