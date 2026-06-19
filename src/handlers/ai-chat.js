import { chat } from '../services/deepseek.js';
import { compressForChat } from '../services/compressor.js';
import riskControl from '../services/risk-control.js';
import messageQueue from '../services/message-queue.js';
import config from '../config.js';
import db from '../database/init.js';
import {
  saveConversationTurn,
  getConversationHistory,
} from '../database/queries.js';
import pluginManager from '../plugins/manager.js';

// 带时间的日志函数
function logWithTime(level, ...args) {
  const time = new Date().toLocaleString('zh-CN', { hour12: false });
  console.error(`[${time}] [${level}]`, ...args);
}

/**
 * AI chat handler — multi-round Q&A with conversation memory.
 * 如果安装了修仙插件，自动带上修为境界
 */
export async function handleAIChat(roomId, sender, content) {
  // Risk check — @mention 跳过随机跳过和冷却，但保留每小时/每日上限
  if (!riskControl.shouldReply(roomId, { skipRandom: true, skipCooldown: true })) return;

  // Strip @bot prefix
  const query = content.replace(/@[^\s]+\s*/, '').trim();
  if (!query) return;

  // Get cultivation info from plugin (if loaded)
  const cultInfo = pluginManager.callAPI('getCultivationInfo', roomId, sender);

  // Build context from recent conversation history
  const history = getConversationHistory(roomId, sender, 6);
  let context = '';

  if (history.length > 0) {
    context = '以下是你们最近的对话记录（按时间顺序）:\n';
    context += history.map(h =>
      h.role === 'user' ? `用户: ${h.content}` : `你: ${h.content}`
    ).join('\n');
    context += '\n\n';
  }

  // Compress current query
  const compressedQuery = compressForChat(sender, query);
  const fullPrompt = context + compressedQuery;

  // Build system prompt
  let systemMsg = config.bot.personality +
    ' 请用简短自然的中文回复，不超过200字。';

  // If cultivation plugin is loaded, add level context
  if (cultInfo) {
    systemMsg += ` 当前提问者的修仙境界为「${cultInfo.title}」（发言${cultInfo.messages}条）。` +
      ` 回复开头用语气暗示对方的境界修为。` +
      ` 对修为低的要调侃鼓励，对修为高的要恭敬吹捧。`;
  }

  try {
    const reply = await chat(fullPrompt, systemMsg);

    // Save conversation turns
    saveConversationTurn(roomId, sender, 'user', query);
    saveConversationTurn(roomId, sender, 'assistant', reply);

    riskControl.recordAIReply(roomId);
    messageQueue.enqueue(roomId, reply);
  } catch (err) {
    logWithTime('ERROR', '[AI Chat]', err.message);
  }
}

/**
 * Clear conversation history for a user
 */
export function handleClearHistory(roomId, sender) {
  const stmt = db.prepare('DELETE FROM conversations WHERE room_id = ? AND sender = ?');
  stmt.run(roomId, sender);
  messageQueue.enqueue(roomId, '🧹 已抹去你的因果。');
}
