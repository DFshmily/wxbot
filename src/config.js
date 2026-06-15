import 'dotenv/config';

function intEnv(key, def) {
  const v = parseInt(process.env[key]);
  return isNaN(v) ? def : v;
}

function floatEnv(key, def) {
  const v = parseFloat(process.env[key]);
  return isNaN(v) ? def : v;
}

export default {
  // DeepSeek
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    baseURL: 'https://api.deepseek.com',
  },

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
};
