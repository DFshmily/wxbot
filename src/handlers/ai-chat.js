import { chat } from '../services/deepseek.js';
import { compressForChat } from '../services/compressor.js';
import riskControl from '../services/risk-control.js';
import messageQueue from '../services/message-queue.js';
import config from '../config.js';

// 带时间的日志函数
function logWithTime(level, ...args) {
  const time = new Date().toLocaleString('zh-CN', { hour12: false });
  console.error(`[${time}] [${level}]`, ...args);
}

/**
 * AI chat handler — single-round Q&A, no history, compressed input.
 * Per doc §4.1 and §7.2: no historical context, single-turn.
 */
export async function handleAIChat(roomId, sender, content) {
  // Risk check
  if (!riskControl.shouldReply(roomId)) return;

  // Strip @bot prefix
  const query = content.replace(/@[^\s]+\s*/, '').trim();
  if (!query) return;

  // Compress input
  const prompt = compressForChat(sender, query);

  // Short system prompt
  const systemMsg = config.bot.personality +
    ' 请用简短自然的中文回复，不超过200字。每次回复风格有所不同。';

  try {
    const reply = await chat(prompt, systemMsg);
    riskControl.recordAIReply(roomId);
    messageQueue.enqueue(roomId, reply);
  } catch (err) {
    logWithTime('ERROR', '[AI Chat]', err.message);
  }
}
