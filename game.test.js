'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomCell, cellOccupied, fillFood, createPlayer, recordScore, tickPlayers, computeTickMs } = require('./game');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makePlayer(id, head, opts = {}) {
  return {
    id,
    color: '#fff',
    snake: [head],
    direction: opts.direction ?? { x: 1, y: 0 },
    nextDir:   opts.nextDir   ?? { x: 1, y: 0 },
    score: opts.score ?? 0,
    alive: opts.alive ?? true,
    name: opts.name ?? `Player ${id}`,
  };
}

// ─── randomCell ───────────────────────────────────────────────────────────────
describe('randomCell', () => {
  it('returns x and y within [0, gridSize)', () => {
    const gridSize = 25;
    for (let i = 0; i < 200; i++) {
      const { x, y } = randomCell(gridSize);
      assert.ok(x >= 0 && x < gridSize, `x=${x} out of range`);
      assert.ok(y >= 0 && y < gridSize, `y=${y} out of range`);
    }
  });

  it('uses the gridSize argument correctly', () => {
    for (let i = 0; i < 100; i++) {
      const { x, y } = randomCell(5);
      assert.ok(x < 5 && y < 5);
    }
  });
});

// ─── cellOccupied ─────────────────────────────────────────────────────────────
describe('cellOccupied', () => {
  it('returns false for empty board', () => {
    assert.equal(cellOccupied({ x: 5, y: 5 }, [], []), false);
  });

  it('returns true when cell is part of a snake', () => {
    const snakes = [[{ x: 3, y: 4 }, { x: 2, y: 4 }]];
    assert.equal(cellOccupied({ x: 3, y: 4 }, snakes, []), true);
    assert.equal(cellOccupied({ x: 2, y: 4 }, snakes, []), true);
  });

  it('returns false when cell is not occupied by a snake', () => {
    const snakes = [[{ x: 3, y: 4 }]];
    assert.equal(cellOccupied({ x: 4, y: 4 }, snakes, []), false);
  });

  it('returns true when cell has food', () => {
    assert.equal(cellOccupied({ x: 7, y: 2 }, [], [{ x: 7, y: 2 }]), true);
  });

  it('returns false when food is elsewhere', () => {
    assert.equal(cellOccupied({ x: 7, y: 2 }, [], [{ x: 8, y: 2 }]), false);
  });

  it('checks multiple snakes', () => {
    const snakes = [[{ x: 1, y: 1 }], [{ x: 2, y: 2 }]];
    assert.equal(cellOccupied({ x: 2, y: 2 }, snakes, []), true);
    assert.equal(cellOccupied({ x: 3, y: 3 }, snakes, []), false);
  });
});

// ─── fillFood ─────────────────────────────────────────────────────────────────
describe('fillFood', () => {
  it('fills food to maxFood from empty', () => {
    const food = [];
    fillFood(food, [], 5, 25);
    assert.equal(food.length, 5);
  });

  it('does not add food beyond maxFood', () => {
    const food = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    fillFood(food, [], 2, 25);
    assert.equal(food.length, 2);
  });

  it('tops up a partial food array', () => {
    const food = [{ x: 0, y: 0 }];
    fillFood(food, [], 3, 25);
    assert.equal(food.length, 3);
  });

  it('all spawned food cells are within grid bounds', () => {
    const food = [];
    fillFood(food, [], 10, 25);
    for (const f of food) {
      assert.ok(f.x >= 0 && f.x < 25 && f.y >= 0 && f.y < 25);
    }
  });

  it('does not spawn food on top of a snake', () => {
    // Fill the entire 5x5 grid with a snake except one cell
    const bigSnake = [];
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 5; x++)
        if (!(x === 4 && y === 4)) bigSnake.push({ x, y });

    const food = [];
    fillFood(food, [bigSnake], 1, 5);
    assert.equal(food.length, 1);
    assert.deepEqual(food[0], { x: 4, y: 4 });
  });
});

// ─── createPlayer ─────────────────────────────────────────────────────────────
describe('createPlayer', () => {
  it('returns a player with the given id and color', () => {
    const p = createPlayer(7, '#ff0000', 25);
    assert.equal(p.id, 7);
    assert.equal(p.color, '#ff0000');
  });

  it('starts alive with score 0', () => {
    const p = createPlayer(1, '#fff', 25);
    assert.equal(p.alive, true);
    assert.equal(p.score, 0);
  });

  it('snake starts with exactly one segment', () => {
    const p = createPlayer(1, '#fff', 25);
    assert.equal(p.snake.length, 1);
  });

  it('head is within the inner grid (avoids edges)', () => {
    for (let i = 0; i < 50; i++) {
      const p = createPlayer(i, '#fff', 25);
      const { x, y } = p.snake[0];
      assert.ok(x >= 2 && x < 23, `x=${x} too close to edge`);
      assert.ok(y >= 2 && y < 23, `y=${y} too close to edge`);
    }
  });

  it('default direction is right', () => {
    const p = createPlayer(1, '#fff', 25);
    assert.deepEqual(p.direction, { x: 1, y: 0 });
    assert.deepEqual(p.nextDir,   { x: 1, y: 0 });
  });

  it('default name includes the id', () => {
    const p = createPlayer(42, '#fff', 25);
    assert.ok(p.name.includes('42'));
  });
});

// ─── recordScore ──────────────────────────────────────────────────────────────
describe('recordScore', () => {
  it('does not record a score of 0', () => {
    const { leaderboard, updated } = recordScore([], 'Alice', 0);
    assert.equal(updated, false);
    assert.equal(leaderboard.length, 0);
  });

  it('does not record a negative score', () => {
    const { updated } = recordScore([], 'Alice', -10);
    assert.equal(updated, false);
  });

  it('records a positive score', () => {
    const { leaderboard, updated } = recordScore([], 'Alice', 50);
    assert.equal(updated, true);
    assert.equal(leaderboard.length, 1);
    assert.equal(leaderboard[0].name, 'Alice');
    assert.equal(leaderboard[0].score, 50);
  });

  it('includes a date string in recorded entries', () => {
    const { leaderboard } = recordScore([], 'Bob', 100);
    assert.ok(typeof leaderboard[0].date === 'string');
    assert.ok(!isNaN(Date.parse(leaderboard[0].date)));
  });

  it('keeps entries sorted highest to lowest', () => {
    let board = [];
    ({ leaderboard: board } = recordScore(board, 'A', 30));
    ({ leaderboard: board } = recordScore(board, 'B', 100));
    ({ leaderboard: board } = recordScore(board, 'C', 60));
    assert.equal(board[0].score, 100);
    assert.equal(board[1].score, 60);
    assert.equal(board[2].score, 30);
  });

  it('caps the leaderboard at topN', () => {
    let board = [];
    for (let i = 1; i <= 12; i++) {
      ({ leaderboard: board } = recordScore(board, `P${i}`, i * 10, 10));
    }
    assert.equal(board.length, 10);
    assert.equal(board[0].score, 120); // highest kept
    assert.equal(board[9].score, 30);  // lowest kept (rank 10)
  });

  it('does not mutate the original leaderboard', () => {
    const original = [{ name: 'X', score: 100, date: '' }];
    recordScore(original, 'Y', 200);
    assert.equal(original.length, 1);
  });
});

// ─── tickPlayers ──────────────────────────────────────────────────────────────
describe('tickPlayers', () => {
  const G = 25;  // gridSize
  const F = 5;   // maxFood

  it('moves a snake one cell in its direction', () => {
    const p = makePlayer(1, { x: 5, y: 5 }, { direction: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 } });
    tickPlayers([p], [], G, F);
    assert.deepEqual(p.snake[0], { x: 6, y: 5 });
  });

  it('snake length stays the same when no food eaten', () => {
    const p = makePlayer(1, { x: 5, y: 5 });
    p.snake.push({ x: 4, y: 5 }); // 2-cell snake
    tickPlayers([p], [], G, F);
    assert.equal(p.snake.length, 2);
  });

  it('wraps horizontally at the right edge', () => {
    const p = makePlayer(1, { x: 24, y: 5 }, { direction: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 } });
    tickPlayers([p], [], G, F);
    assert.equal(p.snake[0].x, 0);
  });

  it('wraps horizontally at the left edge', () => {
    const p = makePlayer(1, { x: 0, y: 5 }, { direction: { x: -1, y: 0 }, nextDir: { x: -1, y: 0 } });
    tickPlayers([p], [], G, F);
    assert.equal(p.snake[0].x, 24);
  });

  it('wraps vertically at the bottom edge', () => {
    const p = makePlayer(1, { x: 5, y: 24 }, { direction: { x: 0, y: 1 }, nextDir: { x: 0, y: 1 } });
    tickPlayers([p], [], G, F);
    assert.equal(p.snake[0].y, 0);
  });

  it('wraps vertically at the top edge', () => {
    const p = makePlayer(1, { x: 5, y: 0 }, { direction: { x: 0, y: -1 }, nextDir: { x: 0, y: -1 } });
    tickPlayers([p], [], G, F);
    assert.equal(p.snake[0].y, 24);
  });

  it('applies nextDir before moving', () => {
    const p = makePlayer(1, { x: 5, y: 5 }, {
      direction: { x: 1, y: 0 },
      nextDir:   { x: 0, y: 1 },  // turn down
    });
    tickPlayers([p], [], G, F);
    assert.deepEqual(p.snake[0], { x: 5, y: 6 });
    assert.deepEqual(p.direction, { x: 0, y: 1 });
  });

  it('eats food: score increases by 10', () => {
    const p    = makePlayer(1, { x: 4, y: 5 });
    const food = [{ x: 5, y: 5 }]; // one step ahead
    tickPlayers([p], food, G, F);
    assert.equal(p.score, 10);
  });

  it('eats food: snake grows by one segment', () => {
    const p    = makePlayer(1, { x: 4, y: 5 });
    const food = [{ x: 5, y: 5 }];
    tickPlayers([p], food, G, F);
    assert.equal(p.snake.length, 2); // was 1, grew to 2
  });

  it('eats food: food item is removed from the array', () => {
    const p    = makePlayer(1, { x: 4, y: 5 });
    const food = [{ x: 5, y: 5 }];
    tickPlayers([p], food, G, F);
    assert.equal(food.some(f => f.x === 5 && f.y === 5), false);
  });

  it('eats food: food is refilled to maxFood', () => {
    const p    = makePlayer(1, { x: 4, y: 5 });
    const food = [{ x: 5, y: 5 }]; // start with 1
    tickPlayers([p], food, G, F);   // maxFood = 5
    assert.equal(food.length, F);
  });

  it('dead players are not moved', () => {
    const p = makePlayer(1, { x: 5, y: 5 }, { alive: false });
    tickPlayers([p], [], G, F);
    assert.deepEqual(p.snake[0], { x: 5, y: 5 }); // unchanged
  });

  it('returns empty newlyDead when no deaths occur', () => {
    const p = makePlayer(1, { x: 5, y: 5 });
    const { newlyDead } = tickPlayers([p], [], G, F);
    assert.equal(newlyDead.length, 0);
  });

  it('returns foodEaten count of 0 when no food is present', () => {
    const p = makePlayer(1, { x: 5, y: 5 });
    const { foodEaten } = tickPlayers([p], [], G, F);
    assert.equal(foodEaten, 0);
  });

  it('returns foodEaten count of 1 when food is eaten', () => {
    const p    = makePlayer(1, { x: 4, y: 5 });
    const food = [{ x: 5, y: 5 }];
    const { foodEaten } = tickPlayers([p], food, G, F);
    assert.equal(foodEaten, 1);
  });

  it('detects self collision', () => {
    // Build a snake that will run into itself next tick
    //   Head at (5,5) moving right → new head (6,5)
    //   Body already occupies (6,5)
    const p = makePlayer(1, { x: 5, y: 5 });
    p.snake = [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }];
    // direction right → new head = (6,5) which is already body[1]
    const { newlyDead } = tickPlayers([p], [], G, F);
    assert.equal(newlyDead.length, 1);
    assert.equal(newlyDead[0].id, 1);
    assert.equal(p.alive, false);
  });

  it('detects collision with another snake', () => {
    const p1 = makePlayer(1, { x: 4, y: 5 }, { direction: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 } });
    const p2 = makePlayer(2, { x: 6, y: 5 }, { direction: { x: 0, y: 1 }, nextDir: { x: 0, y: 1 } });
    // After move: p1 head → (5,5), p2 head → (6,6)
    // Extend p2's snake to include (5,5) so p1 runs into it
    p2.snake = [{ x: 6, y: 5 }, { x: 5, y: 5 }, { x: 4, y: 5 }];

    const { newlyDead } = tickPlayers([p1, p2], [], G, F);
    // p1 head moves to (5,5) which is p2's body → p1 dies
    assert.ok(newlyDead.some(d => d.id === 1), 'p1 should be dead');
    assert.equal(p1.alive, false);
    assert.equal(p2.alive, true);
  });

  it('multiple players can move independently in the same tick', () => {
    const p1 = makePlayer(1, { x: 5, y: 5 }, { nextDir: { x: 1, y: 0 } });
    const p2 = makePlayer(2, { x: 10, y: 10 }, { nextDir: { x: 0, y: -1 } });
    tickPlayers([p1, p2], [], G, F);
    assert.deepEqual(p1.snake[0], { x: 6, y: 5 });
    assert.deepEqual(p2.snake[0], { x: 10, y: 9 });
  });
});

// ─── computeTickMs ────────────────────────────────────────────────────────────
describe('computeTickMs', () => {
  it('returns 200 ms at the start (0 food eaten)', () => {
    assert.equal(computeTickMs(0), 200);
  });

  it('decreases by 8 ms per food eaten', () => {
    assert.equal(computeTickMs(1),  192);
    assert.equal(computeTickMs(5),  160);
    assert.equal(computeTickMs(10), 120);
  });

  it('floors at 70 ms and does not go lower', () => {
    assert.equal(computeTickMs(17), 64 < 70 ? 70 : computeTickMs(17)); // ensure floor
    assert.equal(computeTickMs(17), 70);
    assert.equal(computeTickMs(50), 70);
    assert.equal(computeTickMs(999), 70);
  });

  it('returns a number in the range [70, 200]', () => {
    for (let n = 0; n <= 30; n++) {
      const ms = computeTickMs(n);
      assert.ok(ms >= 70 && ms <= 200, `ms=${ms} out of range at foodEaten=${n}`);
    }
  });
});
