import { getMessageRanking, getHourlyDistribution } from '../database/queries.js';
import wechat from './wechatferry.js';

/**
 * Group statistics — all computed locally in Node (no AI for computation).
 * Per doc §4.4: Node local calculation, AI only for explanation.
 */

// Common Chinese stop words to filter out of word frequency
const STOP_WORDS = new Set([
  '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都',
  '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你',
  '会', '着', '没有', '看', '好', '自己', '这', '他', '她', '它',
  '们', '那', '啊', '吧', '吗', '呢', '哈', '嗯', '哦', '喔',
  '对', '把', '被', '让', '给', '跟', '与', '从', '向', '在',
  '以', '为', '于', '之', '而', '所', '如', '将', '又', '还',
  '已', '已经', '才', '刚', '刚刚', '正在', '可以', '能', '做',
  '来', '去', '出', '进', '回', '到', '过', '开', '打', '拿',
  '吃', '喝', '玩', '什么', '怎么', '为什么', '这个', '那个',
  '这些', '那些', '这样', '那样', '这么', '那么', '非常',
  '太', '很', '更', '最', '比较', '还是', '还是', '就是', '但是',
  '可是', '然而', '不过', '虽然', '因为', '所以', '如果', '然后',
  '关于', '对于', '根据', '按照', '通过', '经过', '比如', '例如',
  '是的', '好的', '收到', '嗯嗯', '哈哈', '呵呵', '嘿嘿',
]);

function extractWords(text) {
  // Extract Chinese word bigrams and single characters
  const chars = text.replace(/[^一-鿿]/g, '');
  if (!chars) return [];

  const words = [];
  // Bigrams
  for (let i = 0; i < chars.length - 1; i++) {
    words.push(chars.slice(i, i + 2));
  }
  // Single characters for remaining
  for (const c of chars) {
    words.push(c);
  }
  return words;
}

function getWordFrequency(messages, topN = 10) {
  const freq = {};

  for (const msg of messages) {
    const words = extractWords(msg.content);
    for (const w of words) {
      if (w.length >= 2 || (w.length === 1 && !STOP_WORDS.has(w))) {
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
