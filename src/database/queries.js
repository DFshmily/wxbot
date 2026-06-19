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

// ===== 签到打卡 =====

/** Check if user already checked in today */
export function hasCheckedIn(roomId, wxid) {
  const today = new Date().toISOString().slice(0, 10);
  const stmt = db.prepare(
    "SELECT id FROM checkins WHERE room_id = ? AND wxid = ? AND checkin_date = ?"
  );
  return !!stmt.get(roomId, wxid, today);
}

/** Save a check-in */
export function saveCheckin(roomId, wxid) {
  const today = new Date().toISOString().slice(0, 10);
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO checkins (room_id, wxid, checkin_date) VALUES (?, ?, ?)"
  );
  stmt.run(roomId, wxid, today);
}

/** Get check-in ranking (total days) */
export function getCheckinRanking(roomId, limit = 10) {
  const stmt = db.prepare(`
    SELECT wxid, COUNT(*) as days, MAX(checkin_date) as last_checkin
    FROM checkins
    WHERE room_id = ?
    GROUP BY wxid
    ORDER BY days DESC, last_checkin DESC
    LIMIT ?
  `);
  return stmt.all(roomId, limit);
}

/** Get user's total check-in days */
export function getUserCheckinDays(roomId, wxid) {
  const stmt = db.prepare(
    "SELECT COUNT(*) as days FROM checkins WHERE room_id = ? AND wxid = ?"
  );
  return stmt.get(roomId, wxid)?.days || 0;
}

/** Get user's consecutive check-in days */
export function getConsecutiveCheckinDays(roomId, wxid) {
  const stmt = db.prepare(`
    SELECT checkin_date FROM checkins
    WHERE room_id = ? AND wxid = ?
    ORDER BY checkin_date DESC
  `);
  const rows = stmt.all(roomId, wxid);
  if (!rows.length) return 0;
  let count = 1;
  for (let i = 1; i < rows.length; i++) {
    const prev = new Date(rows[i - 1].checkin_date);
    const curr = new Date(rows[i].checkin_date);
    const diff = (prev - curr) / 86400000;
    if (Math.round(diff) === 1) count++;
    else break;
  }
  return count;
}

// ===== 关键词回复 =====

/** Get all keyword rules for a room */
export function getKeywordRules(roomId) {
  const stmt = db.prepare(
    "SELECT * FROM keywords WHERE (room_id = '*' OR room_id = ?) AND enabled = 1 ORDER BY room_id ASC, id ASC"
  );
  return stmt.all(roomId);
}

/** Get all keyword rules (admin) */
export function getAllKeywordRules() {
  const stmt = db.prepare("SELECT * FROM keywords ORDER BY room_id, id");
  return stmt.all();
}

/** Save a keyword rule */
export function saveKeywordRule(roomId, keyword, reply, matchType = 'exact') {
  const stmt = db.prepare(`
    INSERT INTO keywords (room_id, keyword, reply, match_type)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(room_id, keyword) DO UPDATE SET reply = excluded.reply, match_type = excluded.match_type
  `);
  stmt.run(roomId, keyword, reply, matchType);
}

/** Delete a keyword rule */
export function deleteKeywordRule(id) {
  const stmt = db.prepare("DELETE FROM keywords WHERE id = ?");
  stmt.run(id);
}

// ===== 对话记忆 =====

/** Save a conversation turn */
export function saveConversationTurn(roomId, sender, role, content) {
  const stmt = db.prepare(
    "INSERT INTO conversations (room_id, sender, role, content) VALUES (?, ?, ?, ?)"
  );
  stmt.run(roomId, sender, role, content);
}

/** Get recent conversation history */
export function getConversationHistory(roomId, sender, limit = 6) {
  const stmt = db.prepare(`
    SELECT role, content FROM conversations
    WHERE room_id = ? AND sender = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(roomId, sender, limit).reverse();
}

/** Clean old conversations (keep last 50 per user) */
export function cleanOldConversations() {
  db.exec(`
    DELETE FROM conversations WHERE id NOT IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY room_id, sender ORDER BY created_at DESC) as rn
        FROM conversations
      ) WHERE rn <= 50
    )
  `);
}

// ===== 用户等级 =====

/** Upsert user activity */
export function upsertUserActivity(roomId, wxid) {
  // Check if this is a new day for the user
  const existing = getUserLevel(roomId, wxid);
  const today = new Date().toISOString().slice(0, 10);
  const isNewDay = !existing || !existing.last_active || !existing.last_active.startsWith(today);

  const stmt = db.prepare(`
    INSERT INTO user_levels (room_id, wxid, total_messages, total_days, last_active)
    VALUES (?, ?, 1, 1, datetime('now','localtime'))
    ON CONFLICT(room_id, wxid) DO UPDATE SET
      total_messages = total_messages + 1,
      total_days = CASE WHEN ? THEN total_days + 1 ELSE total_days END,
      last_active = datetime('now','localtime')
  `);
  // sql.js doesn't support boolean params directly - use 1/0
  stmt.run(roomId, wxid, isNewDay ? 1 : 0);
}

/** Get user level info */
export function getUserLevel(roomId, wxid) {
  const stmt = db.prepare("SELECT * FROM user_levels WHERE room_id = ? AND wxid = ?");
  return stmt.get(roomId, wxid);
}

/** Get level ranking */
export function getLevelRanking(roomId, limit = 10) {
  const stmt = db.prepare(`
    SELECT wxid, total_messages, last_active
    FROM user_levels
    WHERE room_id = ?
    ORDER BY total_messages DESC
    LIMIT ?
  `);
  return stmt.all(roomId, limit);
}

// ===== 修仙游戏 =====

/** Get or create cultivation data */
export function getCultivationData(roomId, wxid) {
  let data = db.prepare('SELECT * FROM cultivation WHERE room_id = ? AND wxid = ?').get(roomId, wxid);
  if (!data) {
    db.prepare(`
      INSERT INTO cultivation (room_id, wxid, spirit_stones, exp_pool, items)
      VALUES (?, ?, 0, 0, '{}')
    `).run(roomId, wxid);
    data = db.prepare('SELECT * FROM cultivation WHERE room_id = ? AND wxid = ?').get(roomId, wxid);
  }
  data.items = JSON.parse(data.items || '{}');
  return data;
}

/** Update cultivation data */
export function updateCultivation(roomId, wxid, updates) {
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(updates)) {
    if (key === 'items') {
      fields.push('items = ?');
      values.push(JSON.stringify(val));
    } else {
      fields.push(`${key} = ?`);
      values.push(val);
    }
  }
  values.push(roomId, wxid);
  db.prepare(`
    UPDATE cultivation SET ${fields.join(', ')} WHERE room_id = ? AND wxid = ?
  `).run(...values);
}

/** Get cultivation ranking by spirit stones */
export function getStoneRanking(roomId, limit = 10) {
  const stmt = db.prepare(`
    SELECT c.wxid, c.spirit_stones, u.total_messages
    FROM cultivation c
    LEFT JOIN user_levels u ON c.room_id = u.room_id AND c.wxid = u.wxid
    WHERE c.room_id = ?
    ORDER BY c.spirit_stones DESC
    LIMIT ?
  `);
  return stmt.all(roomId, limit);
}
