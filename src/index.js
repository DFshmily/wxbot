import cron from 'node-cron';
import wechat from './services/wechatferry.js';
import messageQueue from './services/message-queue.js';
import watchdog from './services/watchdog.js';
import { scheduledSummary } from './handlers/summary.js';
import { startWebServer } from './web/server.js';
import config from './config.js';

/**
 * 微信群AI机器人系统 — Entry point
 * WeChatFerry + DeepSeek + Node.js + SQLite
 *
 * 功能：
 *  - WeChatFerry 微信接入
 *  - AI 对话 (DeepSeek/MiMo)
 *  - 消息存储与查询
 *  - 每日群聊总结
 *  - 风控系统
 *  - 看门狗自重启
 *  - Web 管理后台
 */

let webServer = null;

async function main() {
  console.log('=== 🤖 微信群AI机器人 ===');
  console.log(`Bot: ${config.bot.name}`);
  console.log(`Provider: ${config.llm.provider} | Model: ${config.llm.model}`);
  console.log(`API: ${config.llm.baseURL}`);
  console.log(`Summary cron: ${config.summary.cron}`);
  console.log(`Web port: ${config.web.port}`);
  console.log('');

  // Connect to WeChat via WeChatFerry (with retry)
  await wechat.connect();

  if (!wechat.connected) {
    console.log('⚠️  WeChatFerry 未连接，将以离线模式启动（仅定时任务）');
  }

  // Start watchdog health monitoring
  if (config.watchdog.enabled) {
    watchdog.start({
      wechat,
      messageQueue,
      onRestart: (reason) => {
        console.error(`[Watchdog] Restart triggered: ${reason}`);
        shutdown().then(() => process.exit(1));
      },
    });
  }

  // Start web management server
  webServer = startWebServer();

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

  // Stop watchdog
  watchdog.stop();

  // Close web server
  if (webServer) {
    webServer.close();
  }

  // Disconnect WeChat
  wechat.disconnect();

  console.log('已关闭');
}

try {
  main();
} catch (err) {
  console.error('[Fatal]', err);
  process.exit(1);
}
