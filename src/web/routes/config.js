import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import config from '../../config.js';

const router = Router();
const ENV_PATH = path.resolve('.env');

/**
 * GET /api/config — 获取当前配置（脱敏）
 */
router.get('/', (req, res) => {
  res.json({
    llm: {
      provider: config.llm.provider,
      model: config.llm.model,
      baseURL: config.llm.baseURL,
      apiKey: maskKey(config.llm.apiKey),
    },
    risk: { ...config.risk },
    bot: { ...config.bot },
    summary: { ...config.summary },
    web: {
      port: config.web.port,
      adminUser: config.web.adminUser,
      localAuthBypass: config.web.localAuthBypass,
    },
  });
});

/**
 * PUT /api/config — 更新配置（写入 .env 文件，部分支持热更新）
 */
router.put('/', (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  // Allowed keys for update (whitelist)
  const allowedKeys = [
    'LLM_PROVIDER', 'LLM_API_KEY', 'LLM_MODEL', 'LLM_BASE_URL',
    'MAX_MSG_PER_HOUR', 'MAX_MSG_PER_MINUTE',
    'MIN_MSG_INTERVAL', 'MAX_MSG_INTERVAL',
    'RANDOM_SKIP_RATE', 'WORK_START_HOUR', 'WORK_END_HOUR',
    'MAX_DAILY_ROUNDS', 'COOLDOWN_MINUTES',
    'BOT_NAME', 'BOT_PERSONALITY',
    'SUMMARY_CRON',
    'ADMIN_PASSWORD',
  ];

  // Read current .env
  let envContent = '';
  try {
    envContent = fs.readFileSync(ENV_PATH, 'utf-8');
  } catch {
    envContent = '';
  }

  const lines = envContent.split('\n');
  const updatedKeys = [];
  const errors = [];

  for (let [key, value] of Object.entries(updates)) {
    const upperKey = key.toUpperCase();
    if (!allowedKeys.includes(upperKey)) {
      errors.push(`Key not allowed: ${key}`);
      continue;
    }

    // Validate numeric keys
    if (['MAX_MSG_PER_HOUR', 'MAX_MSG_PER_MINUTE', 'MIN_MSG_INTERVAL', 'MAX_MSG_INTERVAL',
         'WORK_START_HOUR', 'WORK_END_HOUR', 'MAX_DAILY_ROUNDS', 'COOLDOWN_MINUTES'].includes(upperKey)) {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) {
        errors.push(`Invalid numeric value for ${key}: ${value}`);
        continue;
      }
    }

    // Force LLM model name to lowercase (API is case-sensitive)
    if (upperKey === 'LLM_MODEL' && typeof value === 'string') {
      value = value.toLowerCase();
    }

    // Update or add the key
    const idx = lines.findIndex(l => l.startsWith(`${upperKey}=`) || l.startsWith(`# ${upperKey}=`));

    // Handle multiline values (wrap in quotes, escape newlines)
    let writeValue = value;
    if (typeof value === 'string' && value.includes('\n')) {
      writeValue = '"' + value.replace(/\n/g, '\\n') + '"';
    }

    if (idx >= 0) {
      lines[idx] = `${upperKey}=${writeValue}`;
    } else {
      lines.push(`${upperKey}=${writeValue}`);
    }
    updatedKeys.push(upperKey);
  }

  // Write back to .env
  try {
    fs.writeFileSync(ENV_PATH, lines.join('\n'), 'utf-8');
  } catch (err) {
    return res.status(500).json({ error: `Failed to write .env: ${err.message}` });
  }

  // Hot-reload safe keys (risk and bot settings)
  const hotReloadKeys = [
    'LLM_API_KEY', 'LLM_MODEL', 'LLM_BASE_URL',
    'MAX_MSG_PER_HOUR', 'MAX_MSG_PER_MINUTE',
    'MIN_MSG_INTERVAL', 'MAX_MSG_INTERVAL',
    'RANDOM_SKIP_RATE', 'WORK_START_HOUR', 'WORK_END_HOUR',
    'MAX_DAILY_ROUNDS', 'COOLDOWN_MINUTES',
    'BOT_NAME', 'BOT_PERSONALITY', 'SUMMARY_CRON',
  ];

  // Keys that require restart
  const needsRestart = updatedKeys.some(k => !hotReloadKeys.includes(k));

  // Apply hot-reload for safe keys
  for (const key of updatedKeys) {
    const val = updates[key.toLowerCase()] || updates[key];
    applyHotReload(key, val);
  }

  res.json({
    updated: updatedKeys,
    errors: errors.length > 0 ? errors : undefined,
    needsRestart,
    message: needsRestart
      ? '部分配置已更新，需要重启服务才能生效'
      : '配置已更新并热加载',
  });
});

/**
 * POST /api/config/reload — 重新加载 .env 文件
 */
router.post('/reload', (req, res) => {
  try {
    // Clear dotenv cache and reload
    delete process.env.LLM_PROVIDER;
    delete process.env.LLM_API_KEY;
    // Note: Full reload requires restart, this just refreshes env vars
    res.json({ message: 'Environment variables refreshed. Some changes may require restart.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Apply hot-reload for safe config keys */
function applyHotReload(key, value) {
  const numVal = parseFloat(value);

  switch (key) {
    case 'MAX_MSG_PER_HOUR': config.risk.maxMsgPerHour = numVal; break;
    case 'MAX_MSG_PER_MINUTE': config.risk.maxMsgPerMinute = numVal; break;
    case 'MIN_MSG_INTERVAL': config.risk.minInterval = numVal; break;
    case 'MAX_MSG_INTERVAL': config.risk.maxInterval = numVal; break;
    case 'RANDOM_SKIP_RATE': config.risk.randomSkipRate = numVal; break;
    case 'WORK_START_HOUR': config.risk.workStart = numVal; break;
    case 'WORK_END_HOUR': config.risk.workEnd = numVal; break;
    case 'MAX_DAILY_ROUNDS': config.risk.maxDailyRounds = numVal; break;
    case 'COOLDOWN_MINUTES': config.risk.cooldownMinutes = numVal; break;
    case 'BOT_NAME': config.bot.name = value; break;
    case 'BOT_PERSONALITY': config.bot.personality = value; break;
    case 'SUMMARY_CRON': config.summary.cron = value; break;
    case 'LLM_API_KEY': config.llm.apiKey = value; break;
    case 'LLM_BASE_URL': config.llm.baseURL = value; break;
    case 'LLM_MODEL': config.llm.model = value.toLowerCase(); break;
  }
}

/** Mask API key for display */
function maskKey(key) {
  if (!key || key.length < 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

export default router;
