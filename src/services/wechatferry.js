import { Wechatferry } from 'wechatferry';
import messageQueue from './message-queue.js';
import merger from './merger.js';
import { routeMessage } from '../handlers/message-router.js';
import { saveMessage } from '../database/queries.js';
import { compressMessage } from './compressor.js';

// 带时间的日志函数
function logWithTime(level, ...args) {
  const time = new Date().toLocaleString('zh-CN', { hour12: false });
  const prefix = `[${time}] [${level}]`;
  if (level === 'ERROR') {
    console.error(prefix, ...args);
  } else {
    console.log(prefix, ...args);
  }
}

/**
 * WeChatFerry integration layer.
 * Per doc §1: receives messages, sends messages, gets group/user info.
 * Does NOT modify wcf source, do protocol dev, or hook logic.
 */
class WeChatService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.groups = new Set();
    this.contacts = new Map(); // wxid → { name, remark }
    this.lastActiveTime = null;
  }

  async connect(retries = 5, delay = 8000) {
    messageQueue.setSendFn((roomId, content) => this.sendText(roomId, content));
    messageQueue.setImageSendFn((roomId, imagePath) => this.sendImage(roomId, imagePath));

    for (let i = 0; i < retries; i++) {
      try {
        if (i > 0) {
          logWithTime('WCF', `Retry ${i + 1}/${retries} after ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
        }

        logWithTime('WCF', `Connecting (attempt ${i + 1}/${retries})...`);
        this.client = new Wechatferry();
        this.client.on('message', (msg) => this.onMessage(msg));
        this.client.start();

        this.connected = true;
        this.lastActiveTime = Date.now();
        logWithTime('WCF', 'Connected to WeChat');
        this.loadGroups();
        return;
      } catch (err) {
        logWithTime('ERROR', 'WCF Connection failed:', err.message);
        this.connected = false;

        try {
          if (this.client) {
            this.client.stop();
            this.client = null;
          }
        } catch { /* ignore */ }
      }
    }

    logWithTime('ERROR', 'WCF All connection attempts failed, running in offline mode');
  }

  loadGroups() {
    try {
      const contacts = this.client.getContacts();
      for (const c of contacts) {
        if (c.wxid && c.wxid.includes('@chatroom')) {
          this.groups.add(c.wxid);
        } else if (c.wxid) {
          // Build contact name map (remark > name > wxid)
          this.contacts.set(c.wxid, {
            name: c.remark || c.name || c.wxid,
          });
        }
      }
      logWithTime('WCF', `Loaded ${this.groups.size} groups, ${this.contacts.size} contacts`);
    } catch (err) {
      logWithTime('ERROR', 'WCF Failed to load groups:', err.message);
    }
  }

  /** Get display name for a wxid: remark > nickname > alias(微信号) > friendly fallback */
  getDisplayName(wxid) {
    const cached = this.contacts.get(wxid);
    if (cached && cached.name && cached.name !== wxid) return cached.name;

    // Unknown wxid — query WeChat database for alias (微信号)
    try {
      if (this.connected && this.client) {
        const rows = this.client.execDbQuery('MicroMsg.db',
          `SELECT UserName, Alias, NickName, Remark FROM Contact WHERE UserName = '${wxid}'`
        );
        if (rows?.length > 0) {
          const r = rows[0];
          // Try: remark > nickName > alias(微信号)
          const name = r.Remark || r.NickName || r.Alias || '';
          if (name) {
            this.contacts.set(wxid, { name });
            return name;
          }
        }
      }
    } catch { /* WeChat DB not available */ }

    // Also try getContacts as fallback
    try {
      const contacts = this.client.getContacts();
      for (const c of contacts) {
        if (c.wxid === wxid) {
          const name = c.remark || c.name || '';
          if (name) {
            this.contacts.set(wxid, { name });
            return name;
          }
        }
      }
    } catch { /* ignore */ }

    // Last resort: friendly fallback
    const short = wxid.replace('wxid_', '').slice(-4);
    this.contacts.set(wxid, { name: `用户${short}` });
    return `用户${short}`;
  }

  /** Refresh contacts cache */
  refreshContacts() {
    try {
      const contacts = this.client.getContacts();
      for (const c of contacts) {
        if (c.wxid && !c.wxid.includes('@chatroom')) {
          this.contacts.set(c.wxid, {
            name: c.remark || c.name || c.wxid,
          });
        }
      }
    } catch (err) {
      logWithTime('ERROR', 'WCF Failed to refresh contacts:', err.message);
    }
  }

  onMessage(msg) {
    if (!msg.roomid) return;
    if (!msg.content) return;

    logWithTime('MSG', `sender=${msg.sender} type=${msg.type} content=${msg.content.slice(0, 80)}`);

    // Track this group and cache sender (if not already cached, keep sender as-is)
    if (msg.roomid) this.groups.add(msg.roomid);
    if (msg.sender && !this.contacts.has(msg.sender)) {
      this.contacts.set(msg.sender, { name: msg.sender });
    }

    // Store raw message
    const compressed = compressMessage(msg);
    saveMessage(msg.roomid, msg.sender, msg.content, compressed.compressed || null);

    // Forward to merge window for batched routing
    merger.push(msg.roomid, msg, (roomId, messages) => {
      for (const m of messages) {
        routeMessage(roomId, m.sender, m.content);
      }
    });
  }

  sendText(roomId, content) {
    if (!this.connected || !this.client) {
      logWithTime('ERROR', 'WCF Not connected, message dropped:', content.slice(0, 30));
      return;
    }
    try {
      this.client.sendTxt(content, roomId);
      this.lastActiveTime = Date.now();
    } catch (err) {
      logWithTime('ERROR', `WCF Send failed to ${roomId}:`, err.message);
    }
  }

  /**
   * Send an image file to a chat room.
   * @param {string} roomId - Target chat room ID
   * @param {string} imagePath - Absolute path to the image file
   */
  sendImage(roomId, imagePath) {
    if (!this.connected || !this.client) {
      logWithTime('ERROR', 'WCF Not connected, image dropped:', imagePath);
      return;
    }
    try {
      this.client.sendImage(imagePath, roomId);
      this.lastActiveTime = Date.now();
      logWithTime('WCF', `Image sent to ${roomId}: ${imagePath}`);
    } catch (err) {
      logWithTime('ERROR', `WCF Image send failed to ${roomId}:`, err.message);
    }
  }

  /**
   * Health check — returns true if WCF client is connected.
   */
  isHealthy() {
    return this.connected && this.client !== null;
  }

  /**
   * Get service status for monitoring.
   */
  getStatus() {
    return {
      connected: this.connected,
      groupCount: this.groups.size,
      contactCount: this.contacts.size,
      lastActiveTime: this.lastActiveTime || null,
    };
  }

  /** Try to reconnect to WeChat */
  async reconnect() {
    logWithTime('WCF', 'Attempting reconnection...');
    this.disconnect();
    try {
      await this.connect();
      return this.connected;
    } catch (err) {
      logWithTime('ERROR', 'WCF Reconnection failed:', err.message);
      return false;
    }
  }

  disconnect() {
    if (this.client) {
      try {
        this.client.stop();
      } catch { /* ignore */ }
      this.connected = false;
      logWithTime('WCF', 'Disconnected');
    }
  }
}

export default new WeChatService();
