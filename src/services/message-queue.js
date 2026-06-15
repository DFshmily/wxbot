import riskControl from './risk-control.js';

/**
 * Sending queue — all outbound messages go through this.
 * Per doc: queue mechanism required, random delays applied.
 */
class MessageQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.sendFn = null;
  }

  /** Set the actual send function (injected by wechatferry service) */
  setSendFn(fn) {
    this.sendFn = fn;
  }

  /** Add a message to the send queue */
  enqueue(roomId, content) {
    this.queue.push({ roomId, content });
    if (!this.processing) this.process();
  }

  async process() {
    this.processing = true;
    while (this.queue.length > 0) {
      const { roomId, content } = this.queue.shift();
      const delay = riskControl.getDelay();
      await sleep(delay);
      try {
        await this.sendFn(roomId, content);
        riskControl.recordReply(roomId);
      } catch (err) {
        console.error('[MQ] Send failed:', err.message);
      }
    }
    this.processing = false;
  }

  get length() {
    return this.queue.length;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export default new MessageQueue();
