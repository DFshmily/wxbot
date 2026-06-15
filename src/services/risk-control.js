import config from '../config.js';

/**
 * Risk control system per PRD §8:
 * - Rate limiting per group (≤20 AI replies/hr)
 * - Global rate (≤1 msg/sec)
 * - 3-8s merge window
 * - 2-6s random delay
 * - Random non-reply (low probability)
 * - Daily round limit
 * - Working hours only
 */

class RiskControl {
  constructor() {
    this.groupCounts = new Map();
    this.globalTimestamps = [];
    this.dailyCounts = new Map();
    this.aiCooldowns = new Map();
  }

  /** Check if this group is allowed to process messages at all */
  shouldProcess(roomId) {
    const hour = new Date().getHours();
    // start===end means 24/7 operation (no time restriction)
    if (config.risk.workStart === config.risk.workEnd) return true;
    if (hour < config.risk.workStart || hour >= config.risk.workEnd) {
      return false;
    }
    return true;
  }

  /** Check if we should respond to a specific AI request */
  shouldReply(roomId) {
    const now = Date.now();
    const hourKey = new Date().getHours();
    const dateKey = new Date().toISOString().slice(0, 10);

    // Per-group hourly limit
    const group = this.groupCounts.get(roomId);
    if (group && group.hour === hourKey && group.count >= config.risk.maxMsgPerHour) {
      return false;
    }

    // Daily round limit
    const daily = this.dailyCounts.get(roomId);
    if (daily && daily.date === dateKey && daily.count >= config.risk.maxDailyRounds) {
      return false;
    }

    // Global rate: ≤1 per second
    const oneSecAgo = now - 1000;
    this.globalTimestamps = this.globalTimestamps.filter(t => t > oneSecAgo);
    if (this.globalTimestamps.length >= 1) {
      return false;
    }

    // AI cooldown: avoid replying too fast within the same group
    const cooldown = this.aiCooldowns.get(roomId);
    if (cooldown && now - cooldown < config.risk.cooldownMinutes * 60 * 1000) {
      return false;
    }

    // Random skip (low probability to avoid looking like a bot)
    if (Math.random() < config.risk.randomSkipRate) {
      return false;
    }

    return true;
  }

  /** Record a sent reply */
  recordReply(roomId) {
    const now = Date.now();
    const hourKey = new Date().getHours();
    const dateKey = new Date().toISOString().slice(0, 10);

    // Hourly counter
    const group = this.groupCounts.get(roomId) || { count: 0, hour: hourKey };
    if (group.hour !== hourKey) {
      group.count = 0;
      group.hour = hourKey;
    }
    group.count++;
    this.groupCounts.set(roomId, group);

    // Daily counter
    const daily = this.dailyCounts.get(roomId) || { count: 0, date: dateKey };
    if (daily.date !== dateKey) {
      daily.count = 0;
      daily.date = dateKey;
    }
    daily.count++;
    this.dailyCounts.set(roomId, daily);

    // Global rate
    this.globalTimestamps.push(now);

    // Note: cooldown is set separately via recordAIReply()
  }

  /** Record an AI reply and set cooldown (only for AI chat, not commands) */
  recordAIReply(roomId) {
    this.recordReply(roomId);
    this.aiCooldowns.set(roomId, Date.now());
  }

  /** Get random delay in ms (2-6s) */
  getDelay() {
    const min = config.risk.minInterval * 1000;
    const max = config.risk.maxInterval * 1000;
    return Math.floor(Math.random() * (max - min) + min);
  }

  /** Get merge window in ms (3-8s) */
  getMergeWindow() {
    return (config.risk.minInterval + Math.random() * 5) * 1000;
  }

  /** Get or create group config */
  getGroupConfig(roomId) {
    const stmt = db.prepare('SELECT * FROM group_config WHERE room_id = ?');
    let cfg = stmt.get(roomId);
    if (!cfg) {
      const insert = db.prepare('INSERT INTO group_config (room_id) VALUES (?)');
      insert.run(roomId);
      cfg = { room_id: roomId, ai_enabled: 1, game_enabled: 0, whitelist: '' };
    }
    return cfg;
  }
}

import db from '../database/init.js';
export default new RiskControl();
