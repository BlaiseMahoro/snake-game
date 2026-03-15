'use strict';

const path = require('path');
const Database = require('better-sqlite3');

// ─── Connection ───────────────────────────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'scores.db');
let db = null;

function connected() {
  return db !== null;
}

function init() {
  db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS scores (
      id     INTEGER  PRIMARY KEY AUTOINCREMENT,
      name   TEXT     NOT NULL,
      score  INTEGER  NOT NULL,
      date   DATETIME NOT NULL DEFAULT (datetime('now'))
    )
  `);

  console.log(`SQLite database ready at ${DB_PATH}`);
}

// ─── Queries ──────────────────────────────────────────────────────────────────
function getTopScores(limit = 10) {
  if (!db) return [];
  return db
    .prepare('SELECT name, score, date FROM scores ORDER BY score DESC LIMIT ?')
    .all(limit)
    .map(r => ({ name: r.name, score: r.score, date: new Date(r.date + 'Z').toISOString() }));
}

function insertScore(name, score) {
  if (!db) return;
  db.prepare('INSERT INTO scores (name, score) VALUES (?, ?)').run(name, score);
}

module.exports = { init, connected, getTopScores, insertScore };
