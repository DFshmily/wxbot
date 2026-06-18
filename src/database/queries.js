import db from './init.js';

export function saveMessage(roomId, sender, content, compressed) {
  const stmt = db.prepare(
    'INSERT INTO messages (room_id, sender, content, compressed) VALUES (?, ?, ?, ?)'
  );
  stmt.run(roomId, sender, content, compressed || null);
}

/** Get today's messages */
export function getTodayMessages(roomId) {
  const today = new Date().toISOString().slice(0, 10);
  const stmt = db.prepare(
    "SELECT sender, content FROM messages WHERE room_id = ? AND date(time) = ? ORDER BY time"
  );
  return stmt.all(roomId, today);
}

/** Get messages for a specific date (e.g. yesterday) */
export function getMessagesByDate(roomId, dateStr) {
  const stmt = db.prepare(
    "SELECT sender, content, time FROM messages WHERE room_id = ? AND date(time) = ? ORDER BY time"
  );
  return stmt.all(roomId, dateStr);
}

/** Get recent messages */
export function getRecentMessages(roomId, limit = 50) {
  const stmt = db.prepare(
    'SELECT sender, content, time FROM messages WHERE room_id = ? ORDER BY time DESC LIMIT ?'
  );
  return stmt.all(roomId, limit);
}

/** Search messages by keyword */
export function searchMessages(roomId, keyword, limit = 20) {
  const stmt = db.prepare(
    "SELECT sender, content, time FROM messages WHERE room_id = ? AND content LIKE ? ORDER BY time DESC LIMIT ?"
  );
  return stmt.all(roomId, `%${keyword}%`, limit);
}

/** Save a daily summary */
export function saveSummary(roomId, date, content) {
  const stmt = db.prepare(
    'INSERT INTO summaries (room_id, date, content) VALUES (?, ?, ?)'
  );
  stmt.run(roomId, date, content);
}

/** Get message count per user for a time range (发言排行榜) */
export function getMessageRanking(roomId, startDate, endDate, limit = 10) {
  const stmt = db.prepare(`
    SELECT sender, COUNT(*) as count
    FROM messages
    WHERE room_id = ? AND date(time) BETWEEN ? AND ?
    GROUP BY sender
    ORDER BY count DESC
    LIMIT ?
  `);
  return stmt.all(roomId, startDate, endDate, limit);
}

/** Get hourly message distribution */
export function getHourlyDistribution(roomId, dateStr) {
  const stmt = db.prepare(`
    SELECT CAST(strftime('%H', time) AS INTEGER) as hour, COUNT(*) as count
    FROM messages
    WHERE room_id = ? AND date(time) = ?
    GROUP BY hour
    ORDER BY hour
  `);
  return stmt.all(roomId, dateStr);
}

/** Get distinct recent speakers (for 抽签) */
export function getRecentSpeakers(roomId, limit = 20) {
  const stmt = db.prepare(`
    SELECT DISTINCT sender FROM messages
    WHERE room_id = ?
    ORDER BY time DESC
    LIMIT ?
  `);
  return stmt.all(roomId, limit).map(r => r.sender);
}

// ===== Templates =====

/** Get a template by key */
export function getTemplate(key) {
  const stmt = db.prepare('SELECT content FROM templates WHERE key = ?');
  const row = stmt.get(key);
  return row ? row.content : null;
}

/** Save or update a template */
export function saveTemplate(key, content) {
  const stmt = db.prepare(`
    INSERT INTO templates (key, content, updated_at) VALUES (?, ?, datetime('now','localtime'))
    ON CONFLICT(key) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
  `);
  stmt.run(key, content);
}

/** Get all templates */
export function getAllTemplates() {
  const stmt = db.prepare('SELECT key, content, updated_at FROM templates ORDER BY key');
  return stmt.all();
}
