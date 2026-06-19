import { upsertUserActivity } from '../database/queries.js';
import riskControl from '../services/risk-control.js';
import messageQueue from '../services/message-queue.js';
import { handleAIChat, handleClearHistory } from './ai-chat.js';
import { handleManualSummary } from './summary.js';
import { handleGuessGame } from '../games/guess-number.js';
import { handleIdiomGame } from '../games/idiom-chain.js';
import { handleHistoryQuery } from './history.js';
import { generateStatsReport, getWordFrequency } from '../services/statistics.js';
import { getTodayMessages, getTemplate } from '../database/queries.js';
import {
  getWeather, translate, draw, tellJoke,
  getFortune, getCheesyLine, getNews, getHistoryToday,
  getHotSearch, getHoroscope, getRecipe, getPetImage,
  getMeme, generateQRCode,
} from '../services/tools.js';
import { getBalance, getUsageStats } from '../services/deepseek.js';
import config from '../config.js';
import { handleCheckin, handleCheckinRanking } from './checkin.js';
import { checkKeywordMatch } from './custom-reply.js';
import pluginManager from '../plugins/manager.js';
import {
  truthOrDare, getTongueTwister, getPoisonSoup,
  getAcrosticPoem, getDailyMeme,
} from './fun.js';
import {
  handleUndercoverStart, handleUndercoverJoin,
  handleUndercoverDescribe, handleUndercoverVote,
  handleUndercoverEnd,
} from '../games/undercover.js';
import {
  handleWordGuessStart, handleWordGuessHint,
  handleWordGuess, handleWordGuessGiveUp,
} from '../games/word-guess.js';

const BOT_NAME = config.bot.name;

// Default help text — plugin help appended dynamically
function getBaseHelp() {
  return `📖 可用功能
━━━━━━━━━━━━━━
🗣 @${BOT_NAME} 提问 — AI对话（含记忆）
━━━ 签到 ━━━
✅ 签到 — 每日打卡
📋 签到排行 — 签到排名
━━━ 工具 ━━━
🌤 天气 <城市> — 查天气
🔤 翻译 <文本> — 中英互译
🔥 热搜 — 今日热搜榜
🔮 查星座 <星座> — 星座运势
🍳 菜谱 <菜名> — 美食做法
📱 二维码 <内容> — 生成二维码
━━━ 娱乐 ━━━
😂 讲个笑话
🔮 今天运势
💕 土味情话
🎯 抽签 / 抽奖
🧃 毒鸡汤 — 扎心语录
😵 绕口令 — 挑战口条
🎯 真心话 / 大冒险
📜 藏头诗 <字> — AI藏头诗
💥 今日梗图 — 每日一梗
━━━ 游戏 ━━━
🎮 猜数字 — 猜数字游戏
🎮 成语接龙
🎭 谁是卧底 / 卧底 — 身份推理
🎯 猜词 — 猜词游戏
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
💰 余额
📊 用量
━━━ 其他 ━━━
🧹 清除记忆 — 抹去因果`;
}

function getHelpText(roomId) {
  const saved = getTemplate('help');
  let base = saved ? saved.replace(/\{botname\}/g, BOT_NAME) : getBaseHelp();

  // Append plugin help filtered by room
  const pluginLines = pluginManager.getPluginHelp(roomId);
  if (pluginLines.length > 0) {
    base += '\n' + pluginLines.join('\n');
  }

  return base;
}

function isAtBot(text) {
  return text.startsWith(`@${BOT_NAME}`);
}

function stripAtBot(text) {
  return text.replace(/^@\S*\s*/, '').trim();
}

export function routeMessage(roomId, sender, content) {
  const trimmed = content.trim();

  // Track user activity (core)
  try { upsertUserActivity(roomId, sender); } catch { /* ignore */ }

  // Emit message event for plugins (exp accumulation, etc.)
  pluginManager.emit('message', { roomId, wxid: sender });

  if (!riskControl.shouldProcess(roomId)) return;

  // === Try plugins first ===
  if (pluginManager.handleMessage(roomId, sender, trimmed)) return;

  // === Custom keyword replies ===
  const keywordReply = checkKeywordMatch(roomId, trimmed);
  if (keywordReply) {
    messageQueue.enqueue(roomId, keywordReply);
    return;
  }

  // === Exact-match commands ===

  switch (trimmed) {
    // 签到
    case '签到': handleCheckin(roomId, sender); return;
    case '签到排行':
    case '签到排行榜': handleCheckinRanking(roomId); return;

    // 娱乐
    case '今日总结': handleManualSummary(roomId); return;
    case '讲个笑话': tellJoke().then(r => messageQueue.enqueue(roomId, r)); return;
    case '今天运势': getFortune().then(r => messageQueue.enqueue(roomId, r)); return;
    case '土味情话': messageQueue.enqueue(roomId, getCheesyLine()); return;
    case '抽签':
    case '抽奖': messageQueue.enqueue(roomId, draw(roomId, trimmed)); return;
    case '新闻': getNews().then(r => messageQueue.enqueue(roomId, r)); return;
    case '历史上的今天': getHistoryToday().then(r => messageQueue.enqueue(roomId, r)); return;
    case '余额': getBalance().then(r => messageQueue.enqueue(roomId, r)); return;
    case '用量': messageQueue.enqueue(roomId, getUsageStats()); return;
    case '帮助': messageQueue.enqueue(roomId, getHelpText(roomId)); return;
    case '热门':
    case '热搜': getHotSearch().then(r => messageQueue.enqueue(roomId, r)); return;

    // 娱乐 — 新
    case '真心话': messageQueue.enqueue(roomId, truthOrDare('真心话')); return;
    case '大冒险': messageQueue.enqueue(roomId, truthOrDare('大冒险')); return;
    case '绕口令': messageQueue.enqueue(roomId, getTongueTwister()); return;
    case '毒鸡汤': messageQueue.enqueue(roomId, getPoisonSoup()); return;
    case '今日梗图':
    case '今天的梗': getDailyMeme().then(r => messageQueue.enqueue(roomId, r)); return;
    case '清除记忆':
    case '抹去因果':
    case '清空记忆': handleClearHistory(roomId, sender); return;

    // 猜词游戏
    case '猜词': handleWordGuessStart(roomId, sender, trimmed); return;
    case '提示': handleWordGuessHint(roomId); return;
    case '放弃猜词': handleWordGuessGiveUp(roomId); return;

    // 卧底游戏
    case '谁是卧底':
    case '卧底': handleUndercoverStart(roomId, sender, trimmed); return;
    case '加入卧底':
    case '加入': handleUndercoverJoin(roomId, sender); return;
    case '结束卧底': handleUndercoverEnd(roomId); return;

    // 猜数字 & 成语接龙
    case '猜数字': handleGuessGame(roomId, sender, 'start'); return;
    case '成语接龙': handleIdiomGame(roomId, sender, 'start'); return;

    // 群统计
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
  }

  // === 游戏相关 ===
  if (trimmed.startsWith('猜数字 ')) {
    const guess = trimmed.slice(4).trim();
    if (/^\d+$/.test(guess)) {
      handleGuessGame(roomId, sender, 'guess', guess);
      return;
    }
  }

  if (trimmed.startsWith('猜 ') || trimmed.startsWith('猜词 ') && !trimmed.startsWith('猜词 ')) {
    const guessWord = trimmed.replace(/^猜\s*/, '').trim();
    if (guessWord && guessWord.length >= 2) {
      const handled = handleWordGuess(roomId, sender, guessWord);
      if (handled) return;
    }
  }

  if (trimmed.startsWith('投票 ')) {
    const target = trimmed.slice(3).trim();
    const handled = handleUndercoverVote(roomId, sender, target);
    if (handled) return;
  }
  if (trimmed === '弃权') {
    const handled = handleUndercoverVote(roomId, sender, '弃权');
    if (handled) return;
  }

  if (trimmed.startsWith('接龙 ')) {
    const word = trimmed.slice(3).trim();
    if (word) {
      handleIdiomGame(roomId, sender, 'play', word);
      return;
    }
  }

  // === Prefix commands ===

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

  if (trimmed.startsWith('热搜')) {
    getHotSearch().then(r => messageQueue.enqueue(roomId, r));
    return;
  }

  if (trimmed.startsWith('星座') || trimmed.startsWith('查星座')) {
    const sign = trimmed.replace(/^(星座|查星座)\s*/, '').trim();
    getHoroscope(sign).then(r => messageQueue.enqueue(roomId, r));
    return;
  }

  if (trimmed.startsWith('菜谱') || trimmed.startsWith('做法')) {
    const dish = trimmed.replace(/^(菜谱|做法)\s*/, '').trim();
    getRecipe(dish).then(r => messageQueue.enqueue(roomId, r));
    return;
  }

  if (trimmed.startsWith('宠物') || trimmed.startsWith('猫') || trimmed.startsWith('狗')) {
    const type = trimmed.startsWith('猫') ? '猫' : trimmed.startsWith('狗') ? '狗' : '';
    getPetImage(type).then(r => messageQueue.enqueue(roomId, r));
    return;
  }

  if (trimmed.startsWith('表情') || trimmed.startsWith('梗图')) {
    const query = trimmed.replace(/^(表情|梗图)\s*/, '').trim();
    getMeme(query).then(r => messageQueue.enqueue(roomId, r));
    return;
  }

  if (trimmed.startsWith('二维码') || trimmed.startsWith('qr')) {
    const text = trimmed.replace(/^(二维码|qr)\s*/, '').trim();
    generateQRCode(text).then(r => messageQueue.enqueue(roomId, r));
    return;
  }

  if (trimmed.startsWith('藏头诗')) {
    const words = trimmed.replace(/^藏头诗\s*/, '').trim();
    getAcrosticPoem(words).then(r => messageQueue.enqueue(roomId, r));
    return;
  }

  // === 开始游戏 ===
  if (trimmed.startsWith('开始卧底') || trimmed === 'start') {
    handleUndercoverStart(roomId, sender, trimmed);
    return;
  }

  if (trimmed.startsWith('猜词 ') || trimmed.startsWith('开始猜词')) {
    handleWordGuessStart(roomId, sender, trimmed);
    return;
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
