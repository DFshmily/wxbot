import { getMessageRanking, getHourlyDistribution } from '../database/queries.js';
import wechat from './wechatferry.js';

/**
 * Group statistics — all computed locally in Node (no AI for computation).
 * Per doc §4.4: Node local calculation, AI only for explanation.
 */

// Common Chinese stop words to filter out of word frequency
const STOP_WORDS = new Set([
  // Common bigrams
  '一个', '没有', '什么', '怎么', '为什么', '这个', '那个',
  '这些', '那些', '这样', '那样', '这么', '那么', '非常',
  '比较', '还是', '就是', '但是', '可以', '已经', '正在',
  '刚刚', '可能', '应该', '需要', '知道', '觉得', '认为',
  '可是', '然而', '不过', '虽然', '因为', '所以', '如果',
  '然后', '关于', '对于', '根据', '按照', '通过', '经过',
  '比如', '例如', '是的', '好的', '收到', '嗯嗯', '哈哈',
  '呵呵', '嘿嘿', '我们', '你们', '他们', '她们', '它们',
  '自己', '什么', '这里', '那里', '现在', '已经', '可以',
  '不是', '不会', '不能', '不要', '没有', '这样', '那样',
]);

function extractWords(text) {
  // Extract Chinese word bigrams only (no single characters)
  const chars = text.replace(/[^一-鿿]/g, '');
  if (!chars) return [];

  const words = [];
  // Bigrams only
  for (let i = 0; i < chars.length - 1; i++) {
    words.push(chars.slice(i, i + 2));
  }
  return words;
}

function getWordFrequency(messages, topN = 10) {
  const freq = {};

  for (const msg of messages) {
    const words = extractWords(msg.content);
    for (const w of words) {
      if (!STOP_WORDS.has(w)) {
        freq[w] = (freq[w] || 0) + 1;
      }
    }
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }));
}

/**
 * Generate stats report text for a group.
 */
export function generateStatsReport(roomId) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // 发言排行榜 (today)
  const ranking = getMessageRanking(roomId, today, today);
  // 发言排行榜 (yesterday for comparison)
  const rankingYesterday = getMessageRanking(roomId, yesterday, yesterday);
  // 时间分布 (today)
  const hourly = getHourlyDistribution(roomId, today);
  // Total messages today
  const totalToday = ranking.reduce((sum, r) => sum + r.count, 0);

  let report = `📊 今日群统计 (${today})\n`;
  report += `━━━━━━━━━━\n`;

  if (totalToday === 0) {
    return report + '今天还没有消息。';
  }

  report += `总消息数: ${totalToday} 条\n\n`;

  // 发言排行榜
  report += '🏆 发言排行榜\n';
  ranking.slice(0, 5).forEach((r, i) => {
    const name = wechat.getDisplayName(r.sender);
    report += `  ${i + 1}. ${name} (${r.count}条)\n`;
  });

  // 对比昨天
  const totalYesterday = rankingYesterday.reduce((sum, r) => sum + r.count, 0);
  if (totalYesterday > 0) {
    const diff = totalToday - totalYesterday;
    const sign = diff >= 0 ? '+' : '';
    report += `\n📈 较昨日: ${sign}${diff} 条 (昨日 ${totalYesterday} 条)\n`;
  }

  // 时间分布
  if (hourly.length > 0) {
    const peak = hourly.reduce((a, b) => a.count > b.count ? a : b);
    report += `\n⏰ 最活跃时段: ${peak.hour}:00 (${peak.count}条)\n`;
  }

  return report;
}

export { getMessageRanking, getWordFrequency };
