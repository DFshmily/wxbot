import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.resolve('data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'wxbot.db');

// sql.js wrapper — 模拟 better-sqlite3 同步 API，自动持久化
class SqlJsWrapper {
  constructor(sqlite, db, dbPath) {
    this._sqlite = sqlite;
    this._db = db;
    this._dbPath = dbPath;
  }

  exec(sql) {
    this._db.run(sql);
    this._save();
  }

  prepare(sql) {
    return new StmtWrapper(this, this._db, sql);
  }

  pragma(str) {
    // sql.js 不支持 WAL pragma，跳过
  }

  _save() {
    try {
      const data = this._db.export();
      fs.writeFileSync(this._dbPath, Buffer.from(data));
    } catch (e) {
      console.error('[DB] Failed to save:', e.message);
    }
  }
}

class StmtWrapper {
  constructor(wrapper, db, sql) {
    this._wrapper = wrapper;
    this._db = db;
    this._sql = sql;
  }

  run(...params) {
    this._db.run(this._sql, params);
    this._wrapper._save();
  }

  all(...params) {
    const stmt = this._db.prepare(this._sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  get(...params) {
    const rows = this.all(...params);
    return rows[0] || undefined;
  }
}

// 初始化
const SQL = await initSqlJs();
let db;

if (fs.existsSync(DB_PATH)) {
  const buffer = fs.readFileSync(DB_PATH);
  db = new SqlJsWrapper(SQL, new SQL.Database(buffer), DB_PATH);
} else {
  db = new SqlJsWrapper(SQL, new SQL.Database(), DB_PATH);
}

// 建表
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    content TEXT NOT NULL,
    time TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    compressed TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_messages_room_time ON messages(room_id, time);

  CREATE TABLE IF NOT EXISTS game_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    user TEXT NOT NULL,
    game_type TEXT NOT NULL DEFAULT 'guess',
    state TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS group_config (
    room_id TEXT PRIMARY KEY,
    ai_enabled INTEGER NOT NULL DEFAULT 1,
    game_enabled INTEGER NOT NULL DEFAULT 0,
    whitelist TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    date TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_summaries_room_date ON summaries(room_id, date);

  CREATE TABLE IF NOT EXISTS token_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    cost REAL NOT NULL DEFAULT 0,
    time TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS templates (
    key TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );
`);

export default db;
