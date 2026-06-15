import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.resolve('data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'wxbot.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  -- Messages
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    content TEXT NOT NULL,
    time TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    compressed TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_messages_room_time ON messages(room_id, time);

  -- Game state
  CREATE TABLE IF NOT EXISTS game_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    user TEXT NOT NULL,
    game_type TEXT NOT NULL DEFAULT 'guess',
    state TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );

  -- Group config
  CREATE TABLE IF NOT EXISTS group_config (
    room_id TEXT PRIMARY KEY,
    ai_enabled INTEGER NOT NULL DEFAULT 1,
    game_enabled INTEGER NOT NULL DEFAULT 0,
    whitelist TEXT DEFAULT ''
  );

  -- Daily summaries
  CREATE TABLE IF NOT EXISTS summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    date TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_summaries_room_date ON summaries(room_id, date);

  -- Token usage tracking
  CREATE TABLE IF NOT EXISTS token_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    cost REAL NOT NULL DEFAULT 0,
    time TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);

export default db;
