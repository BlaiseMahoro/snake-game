'use strict';

// ─── Pure game logic (no I/O, no globals) ────────────────────────────────────

function randomCell(gridSize) {
  return {
    x: Math.floor(Math.random() * gridSize),
    y: Math.floor(Math.random() * gridSize),
  };
}

/**
 * @param {{x,y}}              cell
 * @param {Array<Array<{x,y}>>} snakes  array of snake body arrays
 * @param {Array<{x,y}>}       food
 */
function cellOccupied(cell, snakes, food) {
  for (const snake of snakes) {
    if (snake.some(s => s.x === cell.x && s.y === cell.y)) return true;
  }
  return food.some(f => f.x === cell.x && f.y === cell.y);
}

/**
 * Fill the food array up to maxFood. Mutates food in place.
 */
function fillFood(food, snakes, maxFood, gridSize) {
  while (food.length < maxFood) {
    let cell, attempts = 0;
    do { cell = randomCell(gridSize); attempts++; }
    while (cellOccupied(cell, snakes, food) && attempts < 100);
    food.push(cell);
  }
}

/**
 * Create a new player object at a random free cell.
 * @param {number} id
 * @param {string} color
 * @param {number} gridSize
 * @param {Array<Array<{x,y}>>} existingSnakes  already-occupied cells
 */
function createPlayer(id, color, gridSize, existingSnakes = []) {
  let head, attempts = 0;
  do {
    head = {
      x: 2 + Math.floor(Math.random() * (gridSize - 4)),
      y: 2 + Math.floor(Math.random() * (gridSize - 4)),
    };
    attempts++;
  } while (cellOccupied(head, existingSnakes, []) && attempts < 200);

  return {
    id,
    color,
    snake: [head],
    direction: { x: 1, y: 0 },
    nextDir:   { x: 1, y: 0 },
    score: 0,
    alive: true,
    name: `Player ${id}`,
  };
}

/**
 * Record a score on the leaderboard. Pure — returns new state.
 * @returns {{ leaderboard: Array, updated: boolean }}
 */
function recordScore(leaderboard, name, score, topN = 10) {
  if (score <= 0) return { leaderboard, updated: false };
  const newBoard = [...leaderboard, { name, score, date: new Date().toISOString() }];
  newBoard.sort((a, b) => b.score - a.score);
  return { leaderboard: newBoard.slice(0, topN), updated: true };
}

/**
 * Advance the game by one tick.
 * Mutates each player's snake / score / alive / direction in place.
 * Mutates the food array in place.
 *
 * @param {Array}  players   array of player objects
 * @param {Array}  food      food array (mutated)
 * @param {number} gridSize
 * @param {number} maxFood
 * @returns {{ newlyDead: Array, foodEaten: number }}
 */
function tickPlayers(players, food, gridSize, maxFood) {
  const alivePlayers = players.filter(p => p.alive);
  let foodEaten = 0;

  // ── Move ──────────────────────────────────────────────────────────────────
  for (const p of alivePlayers) {
    p.direction = { ...p.nextDir };
    const head = p.snake[0];
    const newHead = {
      x: (head.x + p.direction.x + gridSize) % gridSize,
      y: (head.y + p.direction.y + gridSize) % gridSize,
    };
    p.snake.unshift(newHead);

    const foodIdx = food.findIndex(f => f.x === newHead.x && f.y === newHead.y);
    if (foodIdx !== -1) {
      p.score += 10;
      food.splice(foodIdx, 1);
      fillFood(food, players.map(q => q.snake), maxFood, gridSize);
      foodEaten++;
    } else {
      p.snake.pop(); // no growth — remove tail
    }
  }

  // ── Collision detection ───────────────────────────────────────────────────
  const newlyDead = [];
  for (const p of alivePlayers) {
    const head = p.snake[0];

    const selfHit = p.snake.slice(1).some(s => s.x === head.x && s.y === head.y);
    const otherHit = players.some(
      other => other.id !== p.id && other.snake.some(s => s.x === head.x && s.y === head.y)
    );

    if (selfHit || otherHit) {
      p.alive = false;
      newlyDead.push(p);
    }
  }

  return { newlyDead, foodEaten };
}

/**
 * Compute tick interval in ms from the total food eaten so far.
 * Starts at 200 ms, floors at 70 ms.
 */
function computeTickMs(totalFoodEaten) {
  return Math.max(70, 200 - totalFoodEaten * 8);
}

module.exports = { randomCell, cellOccupied, fillFood, createPlayer, recordScore, tickPlayers, computeTickMs };
