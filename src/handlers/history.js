import { getMessagesByDate, searchMessages, getRecentMessages } from '../database/queries.js';
import { summarize } from '../services/deepseek.js';
import { compressForSummary } from '../services/compressor.js';
import messageQueue from '../services/message-queue.js';
import wechat from '../services/wechatferry.js';

/**
 * History query system.
 * Per doc §4.2: "昨天说了什么", "刚才谁提到服务器"
 *
 * Natural language commands:
 *   昨天说了什么 / 昨天群聊     → summarize yesterday
 *   今天说了什么 / 今天群聊     → summarize today
 *   刚才谁提到 <关键词>         → search recent messages for keyword
 *   搜索 <关键词>               → search all messages for keyword
 */

/** Route history-related queries */
export function handleHistoryQuery(roomId, content) {
  const trimmed = content.trim();

  // 昨天说了什么 / 昨天群聊 / 昨天聊了什么
  if (/^昨天/.test(trimmed)) {
    handleYesterdaySummary(roomId);
    return true;
  }

  // 今天说了什么 / 今天群聊
  if (/^今天/.test(trimmed) && /(说了|群聊|聊了|讨论)/.test(trimmed)) {
    handleTodaySummary(roomId);
    return true;
  }

  // 刚才谁提到 <关键词> / 刚才谁说 <关键词> / 谁说了 <关键词>
  const mentionMatch = trimmed.match(/^(刚才谁|谁)(提到|说了|说|发的|发的啥)\s*(.+)/);
  if (mentionMatch) {
    handleKeywordSearch(roomId, mentionMatch[3].trim(), 30);
    return true;
  }

  // 搜索 <关键词> / 查找 <关键词>
  const searchMatch = trimmed.match(/^(搜索|查找|find|查一下)\s*(.+)/);
  if (searchMatch) {
    handleKeywordSearch(roomId, searchMatch[2].trim(), 20);
    return true;
  }

  return false; // Not a history query
}

/** Summarize yesterday's messages */
async function handleYesterdaySummary(roomId) {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const messages = getMessagesByDate(roomId, yesterday);

  if (messages.length === 0) {
    messageQueue.enqueue(roomId, `昨天 (${yesterday}) 没有消息记录。`);
    return;
  }

  messageQueue.enqueue(roomId, `昨天共有 ${messages.length} 条消息，正在生成总结...`);

  const compressed = compressForSummary(messages);
  if (compressed.length === 0) {
    messageQueue.enqueue(roomId, '昨天没有有效消息可总结。');
    return;
  }

  try {
    const result = await summarize(compressed);
    messageQueue.enqueue(roomId, `📋 ${yesterday} 群聊回顾:\n${result}`);
  } catch (err) {
    console.error('[History] Summarize error:', err.message);
    messageQueue.enqueue(roomId, '生成回顾失败，请稍后重试。');
  }
}

/** Summarize today's messages */
async function handleTodaySummary(roomId) {
  const today = new Date().toISOString().slice(0, 10);
  const messages = getMessagesByDate(roomId, today);

  if (messages.length === 0) {
    messageQueue.enqueue(roomId, '今天还没有消息。');
    return;
  }

  messageQueue.enqueue(roomId, `今天已有 ${messages.length} 条消息，正在生成总结...`);

  const compressed = compressForSummary(messages);
  const result = await summarize(compressed);
  messageQueue.enqueue(roomId, `📋 今日群聊回顾:\n${result}`);
}

/** Search for messages containing a keyword */
async function handleKeywordSearch(roomId, keyword, limit) {
  const raw = searchMessages(roomId, keyword);

  // Filter out: the search command itself, and exact keyword-only commands
  const messages = raw.filter(msg => {
    const c = msg.content.trim();
    if (c === `搜索 ${keyword}` || c === `查找 ${keyword}` || c === `查一下 ${keyword}`) return false;
    if (c === keyword) return false;
    return true;
  });

  if (messages.length === 0) {
    messageQueue.enqueue(roomId, `没有找到包含"${keyword}"的相关消息。`);
    return;
  }

  let reply = `🔍 找到 ${messages.length} 条包含"${keyword}"的消息:\n`;
  const show = messages.slice(0, 10);
  for (const msg of show) {
    const time = msg.time?.slice(11, 16) || '';
    const name = wechat.getDisplayName(msg.sender);
    const shortContent = msg.content.length > 60 ? msg.content.slice(0, 60) + '...' : msg.content;
    reply += `\n[${time}] ${name}: ${shortContent}`;
  }
  if (messages.length > 10) {
    reply += `\n...等 ${messages.length} 条`;
  }

  messageQueue.enqueue(roomId, reply);
}
