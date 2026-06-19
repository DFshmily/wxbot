import { Router } from 'express';
import { getAllKeywordRules, saveKeywordRule, deleteKeywordRule } from '../../database/queries.js';

const router = Router();

/**
 * GET /api/keywords — 获取所有关键词规则
 */
router.get('/', (req, res) => {
  const rules = getAllKeywordRules();
  res.json(rules);
});

/**
 * POST /api/keywords — 添加/更新关键词规则
 */
router.post('/', (req, res) => {
  const { room_id, keyword, reply, match_type } = req.body;

  if (!keyword || !reply) {
    return res.status(400).json({ error: 'keyword 和 reply 不能为空' });
  }

  const roomId = room_id || '*';
  const matchType = match_type || 'exact';
  const validTypes = ['exact', 'contains', 'startswith', 'regex'];

  if (!validTypes.includes(matchType)) {
    return res.status(400).json({ error: `match_type 必须是: ${validTypes.join(', ')}` });
  }

  saveKeywordRule(roomId, keyword, reply, matchType);
  res.json({
    message: '✅ 规则已添加',
    rule: { room_id: roomId, keyword, reply, match_type: matchType },
  });
});

/**
 * DELETE /api/keywords/:id — 删除关键词规则
 */
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  deleteKeywordRule(id);
  res.json({ message: '✅ 规则已删除' });
});

export default router;
