import { Router } from 'express';
import pluginManager from '../../plugins/manager.js';

const router = Router();

/**
 * GET /api/plugins — 获取插件列表
 */
router.get('/', (req, res) => {
  const plugins = pluginManager.getPluginList();
  res.json(plugins);
});

/**
 * POST /api/plugins/:name/toggle — 启用/禁用插件
 */
router.post('/:name/toggle', (req, res) => {
  const { enabled } = req.body;
  const result = pluginManager.togglePlugin(req.params.name, enabled);
  if (result.error) return res.status(404).json(result);
  res.json(result);
});

/**
 * POST /api/plugins/:name/uninstall — 卸载插件
 */
router.post('/:name/uninstall', (req, res) => {
  const result = pluginManager.uninstallPlugin(req.params.name);
  if (result.error) return res.status(404).json(result);
  res.json(result);
});

/**
 * GET /api/plugins/rooms/:roomId — 获取插件在指定群的启用状态
 */
router.get('/rooms/:roomId', (req, res) => {
  const plugins = pluginManager.getPluginListForRoom(req.params.roomId);
  res.json({ room_id: req.params.roomId, plugins });
});

/**
 * POST /api/plugins/:name/rooms/:roomId/toggle — 在指定群启用/禁用插件
 */
router.post('/:name/rooms/:roomId/toggle', (req, res) => {
  const { enabled } = req.body;
  const result = pluginManager.togglePluginForRoom(req.params.name, req.params.roomId, enabled);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

export default router;
