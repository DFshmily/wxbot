import { Router } from 'express';
import wechat from '../../services/wechatferry.js';
import messageQueue from '../../services/message-queue.js';
import watchdog from '../../services/watchdog.js';
import riskControl from '../../services/risk-control.js';
import config from '../../config.js';
import db from '../../database/init.js';

const router = Router();

/**
 * GET /api/status — 服务状态概览
 */
router.get('/', (req, res) => {
  const mem = process.memoryUsage();
  const uptime = process.uptime();

  res.json({
    service: {
      name: config.bot.name,
      uptime: Math.round(uptime),
      uptimeHuman: formatUptime(uptime),
      pid: process.pid,
      nodeVersion: process.version,
    },
    wechat: wechat.getStatus(),
    queue: messageQueue.getStats(),
    watchdog: watchdog.getStatus(),
    memory: {
      rss: formatBytes(mem.rss),
      heapUsed: formatBytes(mem.heapUsed),
      heapTotal: formatBytes(mem.heapTotal),
    },
    config: {
      provider: config.llm.provider,
      model: config.llm.model,
      risk: config.risk,
    },
  });
});

/**
 * GET /api/status/health — 简单健康检查（用于负载均衡器）
 */
router.get('/health', (req, res) => {
  const healthy = wechat.isHealthy();
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    connected: wechat.connected,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/status/groups — 群组列表
 */
router.get('/groups', (req, res) => {
  const groups = [...wechat.groups].map(roomId => {
    let groupConfig;
    try {
      const stmt = db.prepare('SELECT * FROM group_config WHERE room_id = ?');
      groupConfig = stmt.get(roomId);
    } catch {
      groupConfig = null;
    }
    return { roomId, config: groupConfig };
  });

  res.json({ groups, total: groups.length });
});

/**
 * GET /api/status/logs — 最近日志（内存中缓存）
 */
router.get('/logs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  res.json({ logs: logBuffer.slice(-limit) });
});

// In-memory log buffer
const logBuffer = [];
const MAX_LOG_BUFFER = 500;

/**
 * Capture console.log/error to buffer for web display.
 */
export function captureLogs() {
  const origLog = console.log;
  const origError = console.error;

  console.log = (...args) => {
    origLog(...args);
    const line = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    logBuffer.push({ level: 'info', time: new Date().toISOString(), message: line });
    if (logBuffer.length > MAX_LOG_BUFFER) logBuffer.shift();
  };

  console.error = (...args) => {
    origError(...args);
    const line = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    logBuffer.push({ level: 'error', time: new Date().toISOString(), message: line });
    if (logBuffer.length > MAX_LOG_BUFFER) logBuffer.shift();
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}天`);
  if (h > 0) parts.push(`${h}小时`);
  if (m > 0) parts.push(`${m}分钟`);
  parts.push(`${s}秒`);
  return parts.join('');
}

export default router;
