import riskControl from './risk-control.js';

/**
 * Message merger — accumulates messages in a 3~8s window
 * before routing, per doc §8.2.
 */
class MessageMerger {
  constructor() {
    this.windows = new Map();  // roomId -> { messages, timer }
  }

  /** Feed a message into the merge window */
  push(roomId, msg, onBatch) {
    let w = this.windows.get(roomId);
    if (!w) {
      w = { messages: [], timer: null };
      this.windows.set(roomId, w);
    }

    w.messages.push(msg);

    if (!w.timer) {
      const windowMs = riskControl.getMergeWindow();
      w.timer = setTimeout(() => this.flush(roomId, onBatch), windowMs);
    }
  }

  flush(roomId, onBatch) {
    const w = this.windows.get(roomId);
    if (!w) return;

    clearTimeout(w.timer);
    this.windows.delete(roomId);

    if (w.messages.length > 0) {
      try {
        onBatch(roomId, w.messages);
      } catch (err) {
        console.error(`[Merger] batch handler error for ${roomId}:`, err.message);
      }
    }
  }

  get pending() {
    return this.windows.size;
  }
}

export default new MessageMerger();
