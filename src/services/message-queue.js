import riskControl from './risk-control.js';

/**
 * Sending queue — all outbound messages go through this.
 * Per doc: queue mechanism required, random delays applied.
 *
 * 支持消息类型：
 *  - text:  文本消息，走随机延迟
 *  - image: 图片消息，跳过延迟直接发送（避免大文件阻塞队列）
 */
class MessageQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.sendTextFn = null;
    this.sendImageFn = null;
  }

  /** Set the actual send functions (injected by wechatferry service) */
  setSendFn(fn) {
    this.sendTextFn = fn;
  }

  setImageSendFn(fn) {
    this.sendImageFn = fn;
  }

  /** Add a text message to the send queue */
  enqueue(roomId, content) {
    this.queue.push({ roomId, content, type: 'text' });
    if (!this.processing) this.process();
  }

  /** Add an image message to the send queue (high priority, no delay) */
  enqueueImage(roomId, imagePath) {
    this.queue.push({ roomId, content: imagePath, type: 'image' });
    if (!this.processing) this.process();
  }

  async process() {
    this.processing = true;
    while (this.queue.length > 0) {
      const msg = this.queue.shift();

      // 图片消息跳过随机延迟，直接发送
      if (msg.type !== 'image') {
        const delay = riskControl.getDelay();
        await sleep(delay);
      }

      try {
        if (msg.type === 'image' && this.sendImageFn) {
          await this.sendImageFn(msg.roomId, msg.content);
        } else {
          await this.sendTextFn(msg.roomId, msg.content);
        }
        riskControl.recordReply(msg.roomId);
      } catch (err) {
        console.error('[MQ] Send failed:', err.message);
      }
    }
    this.processing = false;
  }

  get length() {
    return this.queue.length;
  }

  /** Get queue stats for health monitoring */
  getStats() {
    return {
      pending: this.queue.length,
      processing: this.processing,
    };
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export default new MessageQueue();
