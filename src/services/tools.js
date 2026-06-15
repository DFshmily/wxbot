import { chat } from './deepseek.js';
import { getRecentSpeakers } from '../database/queries.js';
import wechat from './wechatferry.js';

// ============================================================
// Cheesy pick-up lines pool (no API cost)
// ============================================================
const CHEESY_LINES = [
  '你知道我的缺点是什么吗？是缺点你。',
  '你累不累？因为你在我心里跑了一天了。',
  '你会不会喜欢我？不会的话我教你。',
  '我最近在健身，你知道练什么吗？练喜欢你。',
  '你是什么血型？A型？不对，你是我的理想型。',
  '你上辈子一定是碳酸饮料吧，不然我怎么看见你就开心得冒泡。',
  '你有打火机吗？那你是怎么点燃我的心的？',
  '你知道你和星星有什么区别吗？星星在天上，你在我心里。',
  '我可以向你借一下吗？借什么？借你的余生。',
  '你属什么的？属马的？不，你属于我。（划掉）开个玩笑😄',
  '你的脸上有点东西，有什么？有点漂亮。',
  '你是不是偷了我的东西？偷了什么？偷了我的心。',
  '你可以帮我个忙吗？什么忙？帮我照顾好你自己。',
  '我想买一块地，什么地？你的死心塌地。',
  '你累不累？你在我脑海里跑了一天了。',
  '我的手受伤了，你能帮我吹吹吗？看到你我就好了。',
  '你知道我为什么感冒了吗？因为我对你完全没有抵抗力。',
  '你以后能不能别老让我叫你的名字？为什么？因为你的名字太好听了。',
];

// ============================================================
// Weather — wttr.in (free, no API key)
// ============================================================
export async function getWeather(city) {
  try {
    const url = `https://wttr.in/${encodeURIComponent(city)}?m&format=j1&lang=zh`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await resp.json();

    if (!data?.current_condition?.[0]) {
      return `没有找到"${city}"的天气信息。`;
    }

    const cur = data.current_condition[0];
    const todayWeather = data.weather?.[0];

    const desc = cur.weatherDesc?.[0]?.value || '';
    const icon = getWeatherEmoji(desc);
    let report = `🌤 ${city}\n`;
    report += `${icon} ${cur.temp_C}°C 体感${cur.FeelsLikeC}°C\n`;
    report += `💧 ${cur.humidity}% 🌬 ${cur.windspeedKmph}km/h\n`;

    // Hourly forecast (all remaining today, wttr.in returns 3-hour intervals)
    if (todayWeather?.hourly) {
      const curHour = new Date().getHours();
      const nextHours = todayWeather.hourly.filter(h => {
        const hNum = parseInt(h.time) / 100;
        return hNum >= curHour;
      });

      if (nextHours.length > 0) {
        report += `━━━ 逐时 ━━━\n`;
        for (const h of nextHours) {
          const hourLabel = String(parseInt(h.time) / 100).padStart(2, '0') + ':00';
          const icon = getWeatherEmoji(h.weatherDesc?.[0]?.value || '');
          report += `${hourLabel} ${icon} ${h.tempC}°C`;
          if (h.chanceofrain && parseInt(h.chanceofrain) > 0) {
            report += ` 🌧${h.chanceofrain}%`;
          }
          report += '\n';
        }
      }
    }

    // Today's high/low
    if (todayWeather) {
      report += `━━━━━━━━━━\n`;
      report += `今日: ${todayWeather.mintempC}~${todayWeather.maxtempC}°C`;
    }

    return report;
  } catch (err) {
    console.error('[Weather] Error:', err.message);
    return '查询天气失败，请稍后重试。';
  }
}

/** Map weather description to emoji */
function getWeatherEmoji(desc) {
  const map = {
    '晴': '☀️', 'clear': '☀️', 'sunny': '☀️',
    '多云': '⛅', 'partly cloudy': '⛅',
    '阴': '☁️', 'cloudy': '☁️', 'overcast': '☁️',
    '雨': '🌧️', 'rain': '🌧️', 'drizzle': '🌦️', 'shower': '🌦️',
    '雪': '❄️', 'snow': '❄️',
    '雷': '⛈️', 'thunder': '⛈️',
    '雾': '🌫️', 'fog': '🌫️', 'mist': '🌫️',
    '风': '💨', 'wind': '💨',
  };
  const lower = desc.toLowerCase();
  for (const [key, emoji] of Object.entries(map)) {
    if (lower.includes(key)) return emoji;
  }
  return '🌤';
}

// ============================================================
// Translation — DeepSeek
// ============================================================
export async function translate(text) {
  try {
    const system = '你是一个翻译助手。自动检测语言，翻译到目标语言。如果输入包含中文，翻译成英文；否则翻译成中文。只输出翻译结果，不要解释。';
    const prompt = `翻译:\n${text}\n翻译结果:`;
    const result = await chat(prompt, system);
    return `🔤 翻译:\n${text}\n→ ${result}`;
  } catch {
    return '翻译失败，请稍后重试。';
  }
}

// ============================================================
// Random draw — from all group members or @mentions
// ============================================================
export function draw(roomId, content) {
  // Extract @mentioned names from content
  const mentions = [...content.matchAll(/@([^\s\p{Cf}]+)/ug)].map(m => m[1]);

  if (mentions.length > 0) {
    const picked = mentions[Math.floor(Math.random() * mentions.length)];
    return `🎯 抽中: ${picked}`;
  }

  // Try to get all group members from WeChat database
  try {
    if (wechat.connected && wechat.client) {
      // Try ChatRoomMember table (MicroMsg.db)
      const rows = wechat.client.execDbQuery('MicroMsg.db',
        `SELECT UserName FROM ChatRoomMember WHERE ChatRoomName = '${roomId}'`
      );
      if (rows?.length > 1) {
        const members = rows.map(r => r.UserName).filter(Boolean);
        const wxid = members[Math.floor(Math.random() * members.length)];
        const name = wechat.getDisplayName(wxid);
        return `🎯 抽中: ${name} (共${members.length}人)`;
      }
    }
  } catch { /* table may not exist, fall through */ }

  // Fallback: pick from recent speakers in our DB
  const speakers = getRecentSpeakers(roomId);
  if (speakers.length === 0) {
    return '群里还没有活跃成员，发几条消息再试试。';
  }

  const wxid = speakers[Math.floor(Math.random() * speakers.length)];
  const name = wechat.getDisplayName(wxid);
  return `🎯 抽中: ${name} (最近${speakers.length}人)`;
}

// ============================================================
// AI Joke — DeepSeek
// ============================================================
export async function tellJoke() {
  try {
    const result = await chat(
      '讲一个简短好笑的冷笑话或段子。',
      '你是一个讲笑话的助手。只输出笑话本身，不要加任何前缀说明。控制在100字以内。'
    );
    return `😂 ${result}`;
  } catch {
    return '😂 笑话生成失败，我给你讲个真的：\n为什么程序员总是搞混万圣节和圣诞节？因为 Oct 31 == Dec 25。';
  }
}

// ============================================================
// Fortune — DeepSeek
// ============================================================
export async function getFortune() {
  try {
    const result = await chat(
      '生成一个今日运势，格式如下：\n运势评分: ★★★★☆\n幸运数字: 7\n幸运颜色: 蓝色\n财运: 不错\n感情: 稳定\n建议: 保持好心情',
      '你是一个运势生成器。每次生成不同的随机运势。用有趣轻松的语气。'
    );
    return `🔮 今日运势\n${result}`;
  } catch {
    return '🔮 运势生成失败，不过今天一定是好日子！';
  }
}

// ============================================================
// Cheesy line
// ============================================================
export function getCheesyLine() {
  const line = CHEESY_LINES[Math.floor(Math.random() * CHEESY_LINES.length)];
  return `💕 ${line}`;
}

// ============================================================
// Hot news — DeepSeek (recent knowledge from training)
// ============================================================
export async function getNews() {
  try {
    const result = await chat(
      '列出最近几天中国国内最重要的5条新闻热点。每条用一句话概括，20字以内。',
      '你是一个新闻助手。只输出编号列表，不要额外说明。'
    );
    if (result) return `📰 热点速览\n${result}`;
    return '📰 获取新闻失败，请稍后重试。';
  } catch {
    return '📰 获取新闻失败，请稍后重试。';
  }
}

// ============================================================
// On this day in history — DeepSeek
// ============================================================
export async function getHistoryToday() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  try {
    const result = await chat(
      `今天是${month}月${day}日。列出历史上的今天发生的5个重要事件，包含年份和事件简述。格式：年份 — 事件。`,
      '你是一个历史百科助手。只输出事件列表，不要加任何前缀说明或总结。'
    );
    if (result) return `📅 历史上的今天 (${month}月${day}日)\n${result}`;
    return `📅 历史上的今天 (${month}月${day}日)\nDeepSeek 暂时无法获取，稍后再试。`;
  } catch {
    return '📅 获取历史信息失败，请稍后重试。';
  }
}
