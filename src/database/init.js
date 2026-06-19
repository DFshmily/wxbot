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

  -- 签到打卡
  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    wxid TEXT NOT NULL,
    checkin_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(room_id, wxid, checkin_date)
  );
  CREATE INDEX IF NOT EXISTS idx_checkins_room ON checkins(room_id, checkin_date);

  -- 自定义关键词回复
  CREATE TABLE IF NOT EXISTS keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL DEFAULT '*',
    keyword TEXT NOT NULL,
    reply TEXT NOT NULL,
    match_type TEXT NOT NULL DEFAULT 'exact',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(room_id, keyword)
  );
  CREATE INDEX IF NOT EXISTS idx_keywords ON keywords(room_id, keyword);

  -- AI对话上下文记忆
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_conversations ON conversations(room_id, sender, created_at);

  -- 群成员等级
  CREATE TABLE IF NOT EXISTS user_levels (
    room_id TEXT NOT NULL,
    wxid TEXT NOT NULL,
    total_messages INTEGER NOT NULL DEFAULT 1,
    total_days INTEGER NOT NULL DEFAULT 1,
    last_active TEXT DEFAULT (datetime('now','localtime')),
    PRIMARY KEY (room_id, wxid)
  );

  -- 数据库版本管理
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT DEFAULT (datetime('now','localtime'))
  );
`);

// ===== 数据库迁移 =====
const CURRENT_VERSION = 7;

const versionRow = db.prepare('SELECT MAX(version) as v FROM schema_version').get();
const dbVersion = versionRow?.v || 0;

if (dbVersion < CURRENT_VERSION) {
  console.log(`[DB] Migrating from v${dbVersion} to v${CURRENT_VERSION}...`);

  // v7: Clean up — update help template to core-only (plugin handles 修仙 commands)
  if (dbVersion < 7) {
    const newHelp = `📖 可用功能
━━━━━━━━━━━━━━
🗣 @{botname} 提问 — AI对话（含记忆）
━━━ 签到 ━━━
✅ 签到 — 每日打卡
📋 签到排行 — 签到排名
━━━ 工具 ━━━
🌤 天气 <城市> — 查天气
🔤 翻译 <文本> — 中英互译
🔥 热搜 — 今日热搜榜
🔮 查星座 <星座> — 星座运势
🍳 菜谱 <菜名> — 美食做法
📱 二维码 <内容> — 生成二维码
━━━ 娱乐 ━━━
😂 讲个笑话
🔮 今天运势
💕 土味情话
🎯 抽签 / 抽奖
🧃 毒鸡汤 — 扎心语录
😵 绕口令 — 挑战口条
🎯 真心话 / 大冒险
📜 藏头诗 <字> — AI藏头诗
💥 今日梗图 — 每日一梗
━━━ 游戏 ━━━
🎮 猜数字 — 猜数字游戏
🎮 成语接龙
🎭 谁是卧底 / 卧底 — 身份推理
🎯 猜词 — 猜词游戏
━━━ 群聊 ━━━
📊 群统计
📊 高频词
📋 今日总结
📋 昨天说了什么
🔍 搜索 <关键词>
━━━ 资讯 ━━━
📰 新闻
📅 历史上的今天
━━━ 账户 ━━━
💰 余额
📊 用量
━━━ 其他 ━━━
🧹 清除记忆 — 抹去因果`;

    const stmt = db.prepare(`
      INSERT INTO templates (key, content, updated_at) VALUES ('help', ?, datetime('now','localtime'))
      ON CONFLICT(key) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
    `);
    stmt.run(newHelp);
  }

  // Record migration
  const migrateStmt = db.prepare('INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, datetime(\'now\',\'localtime\'))');
  migrateStmt.run(CURRENT_VERSION);
  console.log(`[DB] Migration to v${CURRENT_VERSION} complete`);
}

export default db;
