import { Router } from 'express';
import { getTemplate, saveTemplate, getAllTemplates } from '../../database/queries.js';
import db from '../../database/init.js';

const router = Router();

/**
 * GET /api/templates — 获取所有模板
 */
router.get('/', (req, res) => {
  const templates = getAllTemplates();
  res.json({ templates });
});

/**
 * GET /api/templates/:key — 获取指定模板
 */
router.get('/:key', (req, res) => {
  const content = getTemplate(req.params.key);
  if (content === null) {
    return res.status(404).json({ error: 'Template not found' });
  }
  res.json({ key: req.params.key, content });
});

/**
 * PUT /api/templates/:key — 更新模板
 */
router.put('/:key', (req, res) => {
  const { content } = req.body;
  if (typeof content !== 'string') {
    return res.status(400).json({ error: 'Content must be a string' });
  }

  try {
    saveTemplate(req.params.key, content);
    res.json({ message: 'Template saved', key: req.params.key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/templates/:key — 删除模板（恢复默认）
 */
router.delete('/:key', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM templates WHERE key = ?');
    stmt.run(req.params.key);
    res.json({ message: 'Template deleted, will use default', key: req.params.key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
