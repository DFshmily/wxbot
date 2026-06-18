import 'dotenv/config';

function intEnv(key, def) {
  const v = parseInt(process.env[key]);
  return isNaN(v) ? def : v;
}

function floatEnv(key, def) {
  const v = parseFloat(process.env[key]);
  return isNaN(v) ? def : v;
}

// LLM provider 配置 — 支持 deepseek / mimo
const provider = (process.env.LLM_PROVIDER || 'deepseek').toLowerCase();

const PROVIDER_DEFAULTS = {
  deepseek: { baseURL: 'https://api.deepseek.com', model: 'deepseek-chat' },
  mimo:     { baseURL: 'https://token-plan-cn.xiaomimimo.com/v1', model: 'mimo-v2.5-pro' },
};

const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.deepseek;

export default {
  // LLM
  llm: {
    provider,
    apiKey: process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || '',
    model: process.env.LLM_MODEL || process.env.DEEPSEEK_MODEL || defaults.model,
    baseURL: process.env.LLM_BASE_URL || defaults.baseURL,
  },
  // 保留 deepseek 别名，兼容旧代码
  get deepseek() { return this.llm; },

  // Risk control
  risk: {
    maxMsgPerHour: intEnv('MAX_MSG_PER_HOUR', 20),
    maxMsgPerMinute: intEnv('MAX_MSG_PER_MINUTE', 5),
    minInterval: intEnv('MIN_MSG_INTERVAL', 3),
    maxInterval: intEnv('MAX_MSG_INTERVAL', 8),
    randomSkipRate: floatEnv('RANDOM_SKIP_RATE', 0.1),
    workStart: intEnv('WORK_START_HOUR', 0),
    workEnd: intEnv('WORK_END_HOUR', 0),
    maxDailyRounds: intEnv('MAX_DAILY_ROUNDS', 200),
    cooldownMinutes: intEnv('COOLDOWN_MINUTES', 0),
  },

  // Bot
  bot: {
    name: process.env.BOT_NAME || '小助手',
    personality: process.env.BOT_PERSONALITY || '你是一个友善的微信助手，回复简洁自然。',
  },

  // Summary schedule (default 23:50)
  summary: {
    cron: process.env.SUMMARY_CRON || '50 23 * * *',
  },

  // Web management server
  web: {
    port: intEnv('WEB_PORT', 3080),
    jwtSecret: process.env.JWT_SECRET || 'wxbot-default-secret-change-me',
    jwtExpireHours: intEnv('JWT_EXPIRE_HOURS', 24),
    adminUser: process.env.ADMIN_USERNAME || 'admin',
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
    localAuthBypass: process.env.LOCAL_AUTH_BYPASS !== 'false',
  },

  // Watchdog
  watchdog: {
    enabled: process.env.WATCHDOG_ENABLED !== 'false',
    checkInterval: intEnv('WATCHDOG_CHECK_INTERVAL', 30),
    maxFailures: intEnv('WATCHDOG_MAX_FAILURES', 3),
  },
};
