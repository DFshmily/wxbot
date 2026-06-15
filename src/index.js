import cron from 'node-cron';
import wechat from './services/wechatferry.js';
import { scheduledSummary } from './handlers/summary.js';
import config from './config.js';

/**
 * 微信群AI机器人系统 — Entry point
 * WeChatFerry + DeepSeek + Node.js + SQLite
 *
 * Per doc §12 Phase 1:
 *  - WeChatFerry integration
 *  - AI chat
 *  - Message storage
 *  - Today's summary
 *  - Basic risk control
 */

async function main() {
  console.log('=== 🤖 微信群AI机器人 ===');
  console.log(`Bot: ${config.bot.name}`);
  console.log(`Model: ${config.deepseek.model}`);
  console.log(`Summary cron: ${config.summary.cron}`);
  console.log('');

  // Connect to WeChat via WeChatFerry (sync call)
  wechat.connect();

  if (!wechat.connected) {
    console.log('⚠️  WeChatFerry 未连接，将以离线模式启动（仅定时任务）');
  }

  // Schedule daily summary at 23:50
  cron.schedule(config.summary.cron, async () => {
    console.log(`[Cron] Running daily summary at ${new Date().toLocaleString()}`);
    const groups = [...wechat.groups];
    if (groups.length > 0) {
      await scheduledSummary(groups);
    } else {
      console.log('[Cron] No groups loaded, skipping summary');
    }
  });

  console.log('✅ 系统就绪');

  // Graceful shutdown
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function shutdown() {
  console.log('\n正在关闭...');
  wechat.disconnect();
  process.exit(0);
}

try {
  main();
} catch (err) {
  console.error('[Fatal]', err);
  process.exit(1);
}
