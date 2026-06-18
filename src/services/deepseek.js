import OpenAI from 'openai';
import config from '../config.js';
import db from '../database/init.js';

const client = new OpenAI({
  apiKey: config.deepseek.apiKey,
  baseURL: config.deepseek.baseURL,
});

// 价格 (每百万token, 单位: 元)
const PRICES = {
  // DeepSeek
  'deepseek-chat': { input: 2, output: 8 },
  'deepseek-reasoner': { input: 4, output: 16 },
  // MiMo (Token Plan)
  'mimo-v2.5-pro': { input: 0, output: 0 },
};

function recordUsage(model, promptTokens, completionTokens) {
  const totalTokens = promptTokens + completionTokens;
  const price = PRICES[model] || { input: 2, output: 8 };
  const cost = (promptTokens * price.input + completionTokens * price.output) / 1000000;

  db.prepare(`
    INSERT INTO token_usage (model, prompt_tokens, completion_tokens, total_tokens, cost)
    VALUES (?, ?, ?, ?, ?)
  `).run(model, promptTokens, completionTokens, totalTokens, cost);
}

export async function chat(prompt, systemMsg, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await client.chat.completions.create({
        model: config.deepseek.model,
        messages: [
          { role: 'system', content: systemMsg || config.bot.personality },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1500,
        temperature: 0.8,
      });

      // Record token usage
      if (resp.usage) {
        recordUsage(config.deepseek.model, resp.usage.prompt_tokens || 0, resp.usage.completion_tokens || 0);
      } else {
        // API didn't return usage — still record the call with estimated tokens
        const estimate = Math.ceil(systemMsg.length / 2) + Math.ceil(prompt.length / 2);
        recordUsage(config.deepseek.model, estimate, 0);
      }

      const content = resp.choices[0]?.message?.content;
      if (!content) {
        console.warn(`[${config.llm.provider}] Empty response for prompt:`, prompt.slice(0, 60));
        return '';
      }
      return content.trim();
    } catch (err) {
      // 429 = rate limit, retry after delay
      if (err.status === 429 && i < retries - 1) {
        const delay = (i + 1) * 5000; // 5s, 10s, 15s
        console.warn(`[${config.llm.provider}] Rate limited, retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

export async function summarize(messages) {
  const prompt = `SUMMARIZE:\n${messages.join('\n')}`;
  const system = '你是一个群聊总结助手。用简短的中文总结今日群聊主题、关键事件、结论和待办事项。输出格式：\n#今日主题\n...\n#关键事件\n...\n#结论\n...';
  return chat(prompt, system);
}

export async function gameAction(gameType, state, action, hint) {
  const prompt = `GAME:${gameType}\nSTATE:${state}\nACTION:${action}\n${hint ? `HINT:${hint}` : ''}`;
  const system = '你是一个游戏助手，根据游戏状态和玩家动作给出简短有趣的回应。';
  return chat(prompt, system);
}

/** Query account balance from API */
export async function getBalance() {
  const provider = config.llm.provider;
  try {
    if (provider === 'deepseek') {
      const resp = await fetch('https://api.deepseek.com/user/balance', {
        headers: { Authorization: `Bearer ${config.llm.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) return '查询余额失败。';
      const data = await resp.json();
      const info = data.balance_infos?.[0];
      if (!info) return '查询余额失败，返回数据异常。';
      return `💰 DeepSeek 余额: ¥${info.total_balance}\n` +
        `  充值: ¥${info.topped_up_balance} | 赠送: ¥${info.granted_balance}\n` +
        `  状态: ${data.is_available ? '✅ 可用' : '❌ 余额不足'}`;
    }
    // MiMo Token Plan
    if (provider === 'mimo') {
      return `💰 当前使用 MiMo Token Plan\n  请前往 https://platform.xiaomimimo.com 查看用量`;
    }
    return `💰 当前模型: ${config.llm.model}\n  请前往对应平台查看余额`;
  } catch {
    return '💰 查询余额失败，请检查网络。';
  }
}

/** Get local token usage stats */
export function getUsageStats() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7);
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

  // Today
  const todayStats = db.prepare(`
    SELECT COUNT(*) as calls,
           COALESCE(SUM(prompt_tokens),0) as prompt,
           COALESCE(SUM(completion_tokens),0) as completion,
           COALESCE(SUM(cost),0) as cost
    FROM token_usage WHERE date(time) = ?
  `).get(today);

  // This month
  const monthStats = db.prepare(`
    SELECT COUNT(*) as calls,
           COALESCE(SUM(total_tokens),0) as total,
           COALESCE(SUM(cost),0) as cost
    FROM token_usage WHERE time LIKE ?
  `).get(`${monthStart}%`);

  // Daily breakdown (last 7 days)
  const dailyStats = db.prepare(`
    SELECT date(time) as day,
           COUNT(*) as calls,
           SUM(total_tokens) as total,
           SUM(cost) as cost
    FROM token_usage
    WHERE date(time) BETWEEN ? AND ?
    GROUP BY day ORDER BY day DESC
  `).all(weekAgo, today);

  // All time
  const totalStats = db.prepare(`
    SELECT COUNT(*) as calls,
           COALESCE(SUM(total_tokens),0) as total,
           COALESCE(SUM(cost),0) as cost
    FROM token_usage
  `).get();

  let report = `📊 Token 用量\n━━━━━━━━━━━━\n`;

  // Today
  report += `今日 (${today}):\n`;
  report += `  调用: ${todayStats.calls} 次\n`;
  report += `  输入: ${todayStats.prompt} · 输出: ${todayStats.completion}\n`;
  // Tally up tokens for today's calls correctly
  report += `  费用: ¥${Number(todayStats.cost).toFixed(4)}\n\n`;

  // Daily breakdown
  report += `近7日:\n`;
  for (const day of dailyStats) {
    report += `  ${day.day}  ${day.calls}次  ${day.total} tokens  ¥${Number(day.cost).toFixed(4)}\n`;
  }
  report += `\n`;

  // This month
  report += `本月 (${monthStart}):\n`;
  report += `  调用: ${monthStats.calls} 次\n`;
  report += `  合计: ${monthStats.total} tokens\n`;
  report += `  费用: ¥${Number(monthStats.cost).toFixed(4)}\n\n`;

  // Total
  report += `累计总计:\n`;
  report += `  调用: ${totalStats.calls} 次\n`;
  report += `  合计: ${totalStats.total} tokens\n`;
  report += `  费用: ¥${Number(totalStats.cost).toFixed(4)}`;

  return report;
}
