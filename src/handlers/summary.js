import { summarize } from '../services/deepseek.js';
import { compressForSummary } from '../services/compressor.js';
import { getTodayMessages, saveSummary } from '../database/queries.js';
import messageQueue from '../services/message-queue.js';

/**
 * Daily summary system — triggered by cron (23:50) or manual (#今日总结).
 * Per doc §4.3: messages → SQLite → compress → DeepSeek → output.
 */
export async function generateSummary(roomId) {
  const messages = getTodayMessages(roomId);
  if (messages.length === 0) {
    messageQueue.enqueue(roomId, '今天还没有消息，没有总结。');
    return;
  }

  // Compress
  const compressed = compressForSummary(messages);
  if (compressed.length === 0) {
    messageQueue.enqueue(roomId, '今天没有有效消息可总结。');
    return;
  }

  try {
    const result = await summarize(compressed);
    const today = new Date().toISOString().slice(0, 10);

    // Save summary
    saveSummary(roomId, today, result);
    messageQueue.enqueue(roomId, `📋 今日总结 (${today}):\n${result}`);
  } catch (err) {
    console.error('[Summary] Error:', err.message);
    messageQueue.enqueue(roomId, '生成总结失败，请稍后重试。');
  }
}

/** Manual trigger via #今日总结 */
export async function handleManualSummary(roomId) {
  messageQueue.enqueue(roomId, '正在生成今日总结，请稍候...');
  await generateSummary(roomId);
}

/** Cron trigger for all groups */
export async function scheduledSummary(groupIds) {
  for (const roomId of groupIds) {
    await generateSummary(roomId);
  }
}
