import riskControl from '../services/risk-control.js';
import messageQueue from '../services/message-queue.js';
import { handleAIChat } from './ai-chat.js';
import { handleManualSummary } from './summary.js';
import { handleGuessGame } from '../games/guess-number.js';
import { handleIdiomGame } from '../games/idiom-chain.js';
import { handleHistoryQuery } from './history.js';
import { generateStatsReport, getWordFrequency } from '../services/statistics.js';
import { getTodayMessages } from '../database/queries.js';
import {
  getWeather, translate, draw, tellJoke,
  getFortune, getCheesyLine, getNews, getHistoryToday,
} from '../services/tools.js';
import { getBalance, getUsageStats } from '../services/deepseek.js';
import config from '../config.js';

const BOT_NAME = config.bot.name;

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
      messageQueue.enqueue(roomId,
        `📖 可用功能\n` +
        `━━━━━━━━━━━━━━\n` +
        `🗣 @${BOT_NAME} 提问 — AI对话\n` +
        `━━━ 工具 ━━━\n` +
        `🌤 天气 <城市> — 查天气\n` +
        `🔤 翻译 <文本> — 中英互译\n` +
        `━━━ 娱乐 ━━━\n` +
        `😂 讲个笑话\n` +
        `🔮 今天运势\n` +
        `💕 土味情话\n` +
        `🎯 抽签 / 抽奖\n` +
        `━━━ 群聊 ━━━\n` +
        `📊 群统计\n` +
        `📊 高频词\n` +
        `📋 今日总结\n` +
        `📋 昨天说了什么\n` +
        `🔍 搜索 <关键词>\n` +
        `━━━ 资讯 ━━━\n` +
        `📰 新闻\n` +
        `📅 历史上的今天\n` +
        `━━━ 账户 ━━━\n` +
        `💰 余额 — 查DeepSeek余额\n` +
        `📊 用量 — 查Token消耗\n` +
        `━━━ 游戏 ━━━\n` +
        `🎮 猜数字\n` +
        `🎮 成语接龙`
      );
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
