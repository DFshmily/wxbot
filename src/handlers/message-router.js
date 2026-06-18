import riskControl from '../services/risk-control.js';
import messageQueue from '../services/message-queue.js';
import { handleAIChat } from './ai-chat.js';
import { handleManualSummary } from './summary.js';
import { handleGuessGame } from '../games/guess-number.js';
import { handleIdiomGame } from '../games/idiom-chain.js';
import { handleHistoryQuery } from './history.js';
import { generateStatsReport, getWordFrequency } from '../services/statistics.js';
import { getTodayMessages, getTemplate } from '../database/queries.js';
import {
  getWeather, translate, draw, tellJoke,
  getFortune, getCheesyLine, getNews, getHistoryToday,
} from '../services/tools.js';
import { getBalance, getUsageStats } from '../services/deepseek.js';
import config from '../config.js';

const BOT_NAME = config.bot.name;

// Default help text
const DEFAULT_HELP = `📖 可用功能
━━━━━━━━━━━━━━
🗣 @${BOT_NAME} 提问 — AI对话
━━━ 工具 ━━━
🌤 天气 <城市> — 查天气
🔤 翻译 <文本> — 中英互译
━━━ 娱乐 ━━━
😂 讲个笑话
🔮 今天运势
💕 土味情话
🎯 抽签 / 抽奖
━━━ 群聊 ━━━
📊 群统计
📊 高频词
📋 今日总结
📋 昨天说了什么
🔍 搜索 <关键词>
━━━ 资讯 ━━━
📰 新闻
📅 历史上的今天
━━━ 账户 ━━━
💰 余额 — 查DeepSeek余额
📊 用量 — 查Token消耗
━━━ 游戏 ━━━
🎮 猜数字
🎮 成语接龙`;

/** Get help text from database or use default */
function getHelpText() {
  const saved = getTemplate('help');
  if (saved) {
    // Replace {botname} placeholder
    return saved.replace(/\{botname\}/g, BOT_NAME);
  }
  return DEFAULT_HELP;
}

function isAtBot(text) {
  return text.startsWith(`@${BOT_NAME}`);
}

function stripAtBot(text) {
  return text.replace(/^@\S*\s*/, '').trim();
}

export function routeMessage(roomId, sender, content) {
  const trimmed = content.trim();

  if (!riskControl.shouldProcess(roomId)) return;

  // === Exact-match commands ===

  switch (trimmed) {
    case '今日总结':
      handleManualSummary(roomId);
      return;
    case '猜数字':
      handleGuessGame(roomId, sender, 'start');
      return;
    case '成语接龙':
      handleIdiomGame(roomId, sender, 'start');
      return;
    case '群统计': {
      const report = generateStatsReport(roomId);
      messageQueue.enqueue(roomId, report);
      return;
    }
    case '高频词': {
      const messages = getTodayMessages(roomId);
      if (messages.length === 0) {
        messageQueue.enqueue(roomId, '今天还没有消息。');
        return;
      }
      const freq = getWordFrequency(messages, 15);
      const lines = freq.map((f, i) => `${i + 1}. ${f.word} (${f.count}次)`).join('\n');
      messageQueue.enqueue(roomId, `📊 今日高频词:\n${lines}`);
      return;
    }
    case '讲个笑话':
      tellJoke().then(r => messageQueue.enqueue(roomId, r));
      return;
    case '今天运势':
      getFortune().then(r => messageQueue.enqueue(roomId, r));
      return;
    case '土味情话':
      messageQueue.enqueue(roomId, getCheesyLine());
      return;
    case '抽签':
    case '抽奖':
      messageQueue.enqueue(roomId, draw(roomId, trimmed));
      return;
    case '新闻':
      getNews().then(r => messageQueue.enqueue(roomId, r));
      return;
    case '历史上的今天':
      getHistoryToday().then(r => messageQueue.enqueue(roomId, r));
      return;
    case '余额':
      getBalance().then(r => messageQueue.enqueue(roomId, r));
      return;
    case '用量':
      messageQueue.enqueue(roomId, getUsageStats());
      return;
    case '帮助':
      messageQueue.enqueue(roomId, getHelpText());
      return;
  }

  // === Prefix commands ===

  if (trimmed.startsWith('猜数字 ')) {
    const guess = trimmed.slice(4).trim();
    if (/^\d+$/.test(guess)) {
      handleGuessGame(roomId, sender, 'guess', guess);
      return;
    }
  }

  if (trimmed.startsWith('天气 ')) {
    const city = trimmed.slice(3).trim();
    if (city) {
      getWeather(city).then(r => messageQueue.enqueue(roomId, r));
      return;
    }
  }

  if (trimmed.startsWith('翻译 ')) {
    const text = trimmed.slice(3).trim();
    if (text) {
      translate(text).then(r => messageQueue.enqueue(roomId, r));
      return;
    }
  }

  // === History queries ===
  if (handleHistoryQuery(roomId, trimmed)) {
    return;
  }

  // === AI chat: @bot mention ===
  if (isAtBot(trimmed)) {
    const query = stripAtBot(trimmed);
    if (query) {
      handleAIChat(roomId, sender, query);
    }
    return;
  }
}
