import { Router } from 'express';
import wechat from '../../services/wechatferry.js';
import watchdog from '../../services/watchdog.js';

const router = Router();

/**
 * POST /api/control/restart — 重启服务
 */
router.post('/restart', (req, res) => {
  const reason = req.body?.reason || 'Manual restart via web interface';

  console.log(`[Web] Restart requested: ${reason}`);

  // Send response first
  res.json({
    message: 'Restart initiated, please wait 10 seconds...',
    reason,
    waitSeconds: 10,
  });

  // Delay restart to ensure response is fully sent
  setTimeout(() => {
    console.log('[Web] Executing restart...');
    try {
      wechat.disconnect();
    } catch (e) {
      // ignore
    }
    process.exit(0); // PM2 will restart the process
  }, 2000);
});

/**
 * POST /api/control/reconnect — 重新连接微信
 */
router.post('/reconnect', (req, res) => {
  console.log('[Web] WeChat reconnection requested');

  const success = wechat.reconnect();
  res.json({
    success,
    message: success ? 'WeChat reconnected successfully' : 'WeChat reconnection failed',
    status: wechat.getStatus(),
  });
});

/**
 * POST /api/control/watchdog/reset — 重置看门狗故障计数
 */
router.post('/watchdog/reset', (req, res) => {
  watchdog.consecutiveFailures = 0;
  console.log('[Web] Watchdog failure counter reset');
  res.json({ message: 'Watchdog reset', status: watchdog.getStatus() });
});

/**
 * POST /api/control/watchdog/stop — 停止看门狗
 */
router.post('/watchdog/stop', (req, res) => {
  watchdog.stop();
  res.json({ message: 'Watchdog stopped' });
});

/**
 * POST /api/control/watchdog/start — 启动看门狗
 */
router.post('/watchdog/start', (req, res) => {
  // Note: restart callback needs to be set again
  watchdog.start(watchdog.deps || {});
  res.json({ message: 'Watchdog started', status: watchdog.getStatus() });
});

export default router;
