import { EventEmitter } from 'events';

/**
 * 看门狗服务 — 检测服务卡死并触发自重启
 *
 * 监控维度：
 *  1. 事件循环心跳 — 检测 Node.js 事件循环是否阻塞
 *  2. 微信连接心跳 — 检测 WCF 连接是否存活
 *  3. 消息队列健康 — 检测队列是否积压
 *
 * 触发重启条件（连续 N 次失败）：
 *  - 事件循环超时 30s 无响应
 *  - WCF 连接断开
 *  - 消息队列积压超过 100 条
 */
class Watchdog extends EventEmitter {
  constructor() {
    super();
    this.heartbeatInterval = null;
    this.checks = [];
    this.consecutiveFailures = 0;
    this.maxFailures = 3;
    this.running = false;
    this.lastHeartbeat = Date.now();
    this.restartCallback = null;
  }

  /**
   * Start the watchdog.
   * @param {Object} deps - Dependencies
   * @param {Object} deps.wechat - WeChatService instance
   * @param {Object} deps.messageQueue - MessageQueue instance
   * @param {Function} deps.onRestart - Callback when restart is needed
   */
  start(deps) {
    if (this.running) return;

    this.deps = deps;
    this.running = true;
    this.consecutiveFailures = 0;

    // 事件循环心跳 — 用 setTimeout 检测事件循环是否卡死
    this._startEventLoopHeartbeat();

    // 定期健康检查 — 每 30s 检查一次
    this.heartbeatInterval = setInterval(() => {
      this._runHealthChecks();
    }, 30_000);

    console.log('[Watchdog] Started — monitoring service health');
  }

  /** Stop the watchdog */
  stop() {
    this.running = false;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this._elTimeout) {
      clearTimeout(this._elTimeout);
      this._elTimeout = null;
    }
    console.log('[Watchdog] Stopped');
  }

  /** Event loop heartbeat — if setTimeout fires, event loop is alive */
  _startEventLoopHeartbeat() {
    if (!this.running) return;

    this._elTimeout = setTimeout(() => {
      this.lastHeartbeat = Date.now();
      // Schedule next heartbeat
      this._startEventLoopHeartbeat();
    }, 10_000);

    // If the timeout doesn't fire within 30s, event loop is blocked
    this._elTimeout.unref();
  }

  /** Run all health checks */
  _runHealthChecks() {
    const results = {
      eventLoop: this._checkEventLoop(),
      wechat: this._checkWeChat(),
      queue: this._checkQueue(),
    };

    const allHealthy = Object.values(results).every(r => r.ok);

    if (allHealthy) {
      this.consecutiveFailures = 0;
    } else {
      this.consecutiveFailures++;
      const failures = Object.entries(results)
        .filter(([, v]) => !v.ok)
        .map(([k, v]) => `${k}: ${v.reason}`)
        .join(', ');
      console.warn(`[Watchdog] Health check failed (${this.consecutiveFailures}/${this.maxFailures}): ${failures}`);

      if (this.consecutiveFailures >= this.maxFailures) {
        this._triggerRestart(results);
      }
    }
  }

  /** Check if event loop is responsive */
  _checkEventLoop() {
    const elapsed = Date.now() - this.lastHeartbeat;
    if (elapsed > 30_000) {
      return { ok: false, reason: `Event loop blocked for ${Math.round(elapsed / 1000)}s` };
    }
    return { ok: true };
  }

  /** Check WeChat connection */
  _checkWeChat() {
    if (!this.deps?.wechat) {
      return { ok: false, reason: 'WeChat service not initialized' };
    }
    if (!this.deps.wechat.isHealthy()) {
      return { ok: false, reason: 'WeChat disconnected' };
    }
    return { ok: true };
  }

  /** Check message queue health */
  _checkQueue() {
    if (!this.deps?.messageQueue) {
      return { ok: true }; // Queue not initialized is ok during startup
    }
    const stats = this.deps.messageQueue.getStats();
    if (stats.pending > 100) {
      return { ok: false, reason: `Queue backlog: ${stats.pending} messages` };
    }
    return { ok: true };
  }

  /** Trigger restart — try reconnect first, then full restart */
  _triggerRestart(results) {
    const reason = Object.entries(results)
      .filter(([, v]) => !v.ok)
      .map(([k, v]) => `${k}: ${v.reason}`)
      .join('; ');

    console.error(`[Watchdog] CRITICAL: ${reason}`);
    this.emit('restart', { reason, results });

    // Try reconnecting WeChat first
    if (this.deps?.wechat && !results.wechat.ok) {
      console.log('[Watchdog] Attempting WeChat reconnection...');
      const reconnected = this.deps.wechat.reconnect();
      if (reconnected) {
        console.log('[Watchdog] Reconnection successful, resetting failure count');
        this.consecutiveFailures = 0;
        return;
      }
    }

    // Reconnect failed — trigger full restart
    if (this.deps?.onRestart) {
      console.error('[Watchdog] Triggering service restart...');
      this.deps.onRestart(reason);
    }
  }

  /** Get watchdog status */
  getStatus() {
    return {
      running: this.running,
      consecutiveFailures: this.consecutiveFailures,
      lastHeartbeat: this.lastHeartbeat,
      uptime: this.running ? Date.now() - this.lastHeartbeat : 0,
    };
  }
}

export default new Watchdog();
