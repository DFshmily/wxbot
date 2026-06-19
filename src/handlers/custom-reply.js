import { getKeywordRules, saveKeywordRule, deleteKeywordRule, getAllKeywordRules } from '../database/queries.js';
import messageQueue from '../services/message-queue.js';

/**
 * 自定义关键词回复 — 检查消息是否匹配关键词规则
 */
export function checkKeywordMatch(roomId, content) {
  const rules = getKeywordRules(roomId);
  if (!rules.length) return null;

  for (const rule of rules) {
    if (!rule.enabled) continue;

    switch (rule.match_type) {
      case 'exact':
        if (content === rule.keyword) return rule.reply;
        break;
      case 'contains':
        if (content.includes(rule.keyword)) return rule.reply;
        break;
      case 'startswith':
        if (content.startsWith(rule.keyword)) return rule.reply;
        break;
      case 'regex':
        try {
          const re = new RegExp(rule.keyword, 'i');
          if (re.test(content)) return rule.reply;
        } catch { /* invalid regex */ }
        break;
    }
  }

  return null;
}

/**
 * 管理接口 — 添加/更新规则
 */
export function handleAddRule(roomId, keyword, reply, matchType = 'exact') {
  if (!keyword || !reply) return '请提供关键词和回复内容';
  saveKeywordRule(roomId, keyword, reply, matchType);
  return `✅ 关键词规则已添加: "${keyword}" → "${reply}"`;
}

/**
 * 管理接口 — 删除规则
 */
export function handleDeleteRule(id) {
  deleteKeywordRule(id);
  return '✅ 关键词规则已删除';
}

/**
 * 管理接口 — 获取所有规则
 */
export function handleListRules() {
  const rules = getAllKeywordRules();
  if (!rules.length) return '📋 暂无关键词回复规则';
  return rules.map((r, i) =>
    `${i + 1}. [${r.room_id === '*' ? '全局' : r.room_id}] ${r.keyword} → ${r.reply.slice(0, 30)}${r.reply.length > 30 ? '...' : ''}`
  ).join('\n');
}
