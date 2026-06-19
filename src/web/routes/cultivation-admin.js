import { Router } from 'express';
import db from '../../database/init.js';
import wechat from '../../services/wechatferry.js';

const router = Router();

// ---- defaults (mirrors plugin constants for admin reference) ----
const REALMS = [
  { idx: 0,  title: '🧘 练气初期',     realm: '练气期', min: 0 },
  { idx: 1,  title: '🧘 练气中期',     realm: '练气期', min: 10 },
  { idx: 2,  title: '🧘 练气后期',     realm: '练气期', min: 50 },
  { idx: 3,  title: '🏛 筑基初期',     realm: '筑基期', min: 100 },
  { idx: 4,  title: '🏛 筑基中期',     realm: '筑基期', min: 200 },
  { idx: 5,  title: '🏛 筑基后期',     realm: '筑基期', min: 500 },
  { idx: 6,  title: '💎 结丹初期',     realm: '结丹期', min: 1000 },
  { idx: 7,  title: '💎 结丹中期',     realm: '结丹期', min: 2000 },
  { idx: 8,  title: '💎 结丹后期',     realm: '结丹期', min: 5000 },
  { idx: 9,  title: '👁 元婴初期',     realm: '元婴期', min: 10000 },
  { idx: 10, title: '👁 元婴中期',     realm: '元婴期', min: 20000 },
  { idx: 11, title: '👁 元婴后期',     realm: '元婴期', min: 50000 },
  { idx: 12, title: '✨ 化神期·大能', realm: '化神期', min: 100000 },
];

const DEFAULT_SHOP = [
  // ========== 法器/法宝 ==========
  { id: '飞行法器·青竹蜂云剑',  type: 'equipment', price: 200,  desc: '签到额外+3灵石',       passive: 'checkin_bonus',   passiveVal: 3 },
  { id: '攻击法器·紫凝刃',      type: 'equipment', price: 600,  desc: '斗法胜率+6%',          passive: 'duel_win_rate',   passiveVal: 0.06 },
  { id: '防御法宝·元天虚灵甲',  type: 'equipment', price: 500,  desc: '斗法失败少扣50%灵石',  passive: 'duel_loss_protect', passiveVal: 0.5 },
  { id: '防御法宝·八灵尺',      type: 'equipment', price: 400,  desc: '斗法失败少扣30%灵石',  passive: 'duel_loss_protect', passiveVal: 0.3 },
  { id: '攻击法宝·玄天斩灵剑',  type: 'equipment', price: 800,  desc: '斗法胜率+8%',          passive: 'duel_win_rate',   passiveVal: 0.08 },
  { id: '异火·乾蓝冰焰',        type: 'equipment', price: 1500, desc: '斗法胜率+15%',         passive: 'duel_win_rate',   passiveVal: 0.15 },
  { id: '通天灵宝·虚天鼎',      type: 'equipment', price: 2000, desc: '签到额外+8灵石',       passive: 'checkin_bonus',   passiveVal: 8 },
  { id: '玄天之宝·玄黄之气',    type: 'equipment', price: 2500, desc: '突破成功率+12%',        passive: 'breakthrough_rate', passiveVal: 0.12 },
  { id: '剑阵·万剑图',          type: 'equipment', price: 3000, desc: '斗法胜率+20%',         passive: 'duel_win_rate',   passiveVal: 0.20 },
  { id: '至宝·混沌万灵塔',      type: 'equipment', price: 3500, desc: '签到额外+12灵石',      passive: 'checkin_bonus',   passiveVal: 12 },

  // ========== 灵兽 ==========
  { id: '灵兽·噬金虫',         type: 'pet',       price: 1000, desc: '签到额外+5灵石',       passive: 'checkin_bonus',   passiveVal: 5 },
  { id: '灵兽·豹麟兽',         type: 'pet',       price: 2000, desc: '签到额外+7灵石',       passive: 'checkin_bonus',   passiveVal: 7 },
  { id: '灵兽·啼魂兽',         type: 'pet',       price: 2000, desc: '斗法胜率+12%',         passive: 'duel_win_rate',   passiveVal: 0.12 },
  { id: '灵兽·血玉蜘蛛',       type: 'pet',       price: 2500, desc: '突破成功率+8%',        passive: 'breakthrough_rate', passiveVal: 0.08 },
  { id: '灵兽·银翅夜鹏',       type: 'pet',       price: 3000, desc: '签到额外+10灵石',      passive: 'checkin_bonus',   passiveVal: 10 },
  { id: '灵兽·冰凤',           type: 'pet',       price: 4000, desc: '斗法胜率+18%',         passive: 'duel_win_rate',   passiveVal: 0.18 },
  { id: '灵兽·噬金虫王(金童)', type: 'pet',       price: 5000, desc: '斗法胜率+25%',         passive: 'duel_win_rate',   passiveVal: 0.25 },
  { id: '灵兽·蟹道人',         type: 'pet',       price: 5500, desc: '签到+15、斗法+10%',    passive: 'checkin_bonus',   passiveVal: 15 },

  // ========== 功法 ==========
  { id: '功法·万毒淬体功',     type: 'technique', price: 800,  desc: '突破成功率+5%',        passive: 'breakthrough_rate', passiveVal: 0.05 },
  { id: '功法·大衍决',         type: 'technique', price: 1500, desc: '突破成功率+10%',       passive: 'breakthrough_rate', passiveVal: 0.10 },
  { id: '功法·罗烟步',         type: 'technique', price: 1500, desc: '斗法胜率+8%',          passive: 'duel_win_rate',   passiveVal: 0.08 },
  { id: '功法·天遁术',         type: 'technique', price: 2000, desc: '斗法失败少扣40%灵石',  passive: 'duel_loss_protect', passiveVal: 0.4 },
  { id: '功法·明王诀',         type: 'technique', price: 2500, desc: '突破成功率+15%',        passive: 'breakthrough_rate', passiveVal: 0.15 },
  { id: '功法·五藏锻元功',     type: 'technique', price: 2500, desc: '突破失败只损失60%修为', passive: 'breakthrough_loss', passiveVal: 0.6 },
  { id: '功法·三转重元功',     type: 'technique', price: 3000, desc: '突破失败只损失50%修为', passive: 'breakthrough_loss', passiveVal: 0.5 },
  { id: '功法·真灵十二变',     type: 'technique', price: 3500, desc: '斗法胜率+18%',         passive: 'duel_win_rate',   passiveVal: 0.18 },
  { id: '功法·梵圣真魔功',     type: 'technique', price: 4000, desc: '突破成功率+20%',        passive: 'breakthrough_rate', passiveVal: 0.20 },

  // ========== 消耗品 ==========
  { id: '符箓·天机符·一张',    type: 'consumable', price: 600, desc: '下次突破必定成功',       passive: 'breakthrough_auto', passiveVal: 1 },
  { id: '符箓·封灵符·一张',    type: 'consumable', price: 800, desc: '下次突破必定成功',       passive: 'breakthrough_auto', passiveVal: 1 },
  { id: '符箓·爆裂符·一张',    type: 'consumable', price: 500, desc: '下次斗法必胜',           passive: 'duel_auto_win',   passiveVal: 1 },
  { id: '剑阵·纯阳剑阵·一次',   type: 'consumable', price: 800, desc: '下次斗法必胜',          passive: 'duel_auto_win',   passiveVal: 1 },
  { id: '傀儡·人形傀儡·一只',   type: 'consumable', price: 1000, desc: '下次斗法必胜',         passive: 'duel_auto_win',   passiveVal: 1 },
];

const DEFAULT_PILLS = {
  '聚气丹': { cost: 10, bonus: 0.10, desc: '突破成功率+10%' },
  '筑基丹': { cost: 50, bonus: 0.20, desc: '突破成功率+20%' },
  '凝碧丹': { cost: 100, bonus: 0.15, desc: '突破成功率+15%' },
  '结金丹': { cost: 200, bonus: 0.30, desc: '突破成功率+30%' },
  '天元丹': { cost: 300, bonus: 0.40, desc: '突破成功率+40%' },
  '渡劫丹': { cost: 500, bonus: 0.50, desc: '突破成功率+50%' },
};

const BREAKTHROUGH_COSTS = [10, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];

// ---- helpers ----

function getDBConfig(key) {
  const row = db.prepare('SELECT value FROM plugin_config WHERE plugin = ? AND key = ?').get('cultivation', key);
  return row ? JSON.parse(row.value) : null;
}

function setDBConfig(key, value) {
  db.prepare('INSERT OR REPLACE INTO plugin_config (plugin, key, value) VALUES (?, ?, ?)').run('cultivation', key, JSON.stringify(value));
}

function getRealmTitle(idx) {
  const r = REALMS[Math.min(Math.max(0, idx), REALMS.length - 1)];
  return r ? r.title : '未知';
}

function parseItemCounts(itemsJson) {
  const items = typeof itemsJson === 'string' ? JSON.parse(itemsJson) : (itemsJson || {});
  const categories = ['pills', 'equipment', 'pets', 'techniques', 'consumables'];
  let total = 0;
  for (const cat of categories) {
    if (items[cat]) {
      for (const [, count] of Object.entries(items[cat])) {
        total += count;
      }
    }
  }
  return total;
}

// ============================================================
// Routes
// ============================================================

/**
 * GET /api/plugins/cultivation/users — 获取所有修仙用户列表
 * Query: ?room_id=xxx 可选过滤群
 */
router.get('/users', (req, res) => {
  try {
    let sql = `
      SELECT c.room_id, c.wxid, c.spirit_stones, c.exp_pool, c.realm_idx,
             c.items, c.consecutive_fails,
             COALESCE(u.total_messages, 0) as total_messages
      FROM cultivation c
      LEFT JOIN user_levels u ON c.room_id = u.room_id AND c.wxid = u.wxid
    `;
    const params = [];
    if (req.query.room_id) {
      sql += ' WHERE c.room_id = ?';
      params.push(req.query.room_id);
    }
    sql += ' ORDER BY c.realm_idx DESC, c.spirit_stones DESC';

    const rows = db.prepare(sql).all(...params);
    const users = rows.map(r => {
      let displayName = '';
      let roomName = '';
      try { displayName = wechat.getDisplayName(r.wxid) || ''; } catch {}
      try { roomName = wechat.getDisplayName(r.room_id) || ''; } catch {}
      if (displayName === r.wxid || displayName === `用户${r.wxid.replace('wxid_', '').slice(-4)}`) displayName = '';
      if (roomName === r.room_id) roomName = '';
      return {
        room_id: r.room_id,
        room_name: roomName,
        wxid: r.wxid,
        display_name: displayName,
        realm_idx: r.realm_idx || 0,
        realm_title: getRealmTitle(r.realm_idx || 0),
        spirit_stones: r.spirit_stones || 0,
        exp_pool: r.exp_pool || 0,
        items: r.items,
        items_count: parseItemCounts(r.items),
        total_messages: r.total_messages || 0,
        consecutive_fails: r.consecutive_fails || 0,
      };
    });

    res.json({ users, total: users.length });
  } catch (err) {
    console.error('[CultivationAdmin] GET /users error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/plugins/cultivation/users/:wxid — 更新用户数据
 * Body: { room_id, realm_idx?, spirit_stones?, exp_pool?, consecutive_fails? }
 */
router.put('/users/:wxid', (req, res) => {
  try {
    const { room_id, realm_idx, spirit_stones, exp_pool, consecutive_fails, items } = req.body;
    if (!room_id) return res.status(400).json({ error: '缺少 room_id' });

    const updates = {};
    if (realm_idx !== undefined) updates.realm_idx = realm_idx;
    if (spirit_stones !== undefined) updates.spirit_stones = spirit_stones;
    if (exp_pool !== undefined) updates.exp_pool = exp_pool;
    if (consecutive_fails !== undefined) updates.consecutive_fails = consecutive_fails;
    if (items !== undefined) updates.items = items;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    const fields = [], values = [];
    for (const [k, v] of Object.entries(updates)) {
      fields.push(`${k} = ?`);
      values.push(k === 'items' ? JSON.stringify(v) : v);
    }
    values.push(room_id, req.params.wxid);

    db.prepare(`UPDATE cultivation SET ${fields.join(', ')} WHERE room_id = ? AND wxid = ?`).run(...values);
    res.json({ success: true, message: '用户数据已更新' });
  } catch (err) {
    console.error('[CultivationAdmin] PUT /users error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/plugins/cultivation/users/:wxid — 删除用户修仙数据
 * Body: { room_id }
 */
router.delete('/users/:wxid', (req, res) => {
  try {
    const { room_id } = req.body;
    if (!room_id) return res.status(400).json({ error: '缺少 room_id' });

    db.prepare('DELETE FROM cultivation WHERE room_id = ? AND wxid = ?').run(room_id, req.params.wxid);
    res.json({ success: true, message: '用户修仙数据已删除' });
  } catch (err) {
    console.error('[CultivationAdmin] DELETE /users error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/plugins/cultivation/users/:wxid/items — 给用户添加物品
 * Body: { room_id, category, item_id, count }
 *   category: 'pills' | 'equipment' | 'pets' | 'techniques' | 'consumables'
 */
router.post('/users/:wxid/items', (req, res) => {
  try {
    const { room_id, category, item_id, count = 1 } = req.body;
    if (!room_id || !category || !item_id) {
      return res.status(400).json({ error: '缺少 room_id / category / item_id' });
    }

    const row = db.prepare('SELECT items FROM cultivation WHERE room_id = ? AND wxid = ?').get(room_id, req.params.wxid);
    if (!row) return res.status(404).json({ error: '用户不存在' });

    const items = JSON.parse(row.items || '{}');
    if (!items[category]) items[category] = {};
    items[category][item_id] = (items[category][item_id] || 0) + count;

    db.prepare('UPDATE cultivation SET items = ? WHERE room_id = ? AND wxid = ?').run(JSON.stringify(items), room_id, req.params.wxid);
    res.json({ success: true, message: `已添加 ${item_id} x${count}` });
  } catch (err) {
    console.error('[CultivationAdmin] POST /items error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/plugins/cultivation/users/:wxid/items/:itemId — 删除用户物品
 * Body: { room_id, category }
 */
router.delete('/users/:wxid/items/:itemId', (req, res) => {
  try {
    const { room_id, category } = req.body;
    if (!room_id || !category) return res.status(400).json({ error: '缺少 room_id / category' });

    const row = db.prepare('SELECT items FROM cultivation WHERE room_id = ? AND wxid = ?').get(room_id, req.params.wxid);
    if (!row) return res.status(404).json({ error: '用户不存在' });

    const items = JSON.parse(row.items || '{}');
    if (items[category]) {
      delete items[category][req.params.itemId];
    }

    db.prepare('UPDATE cultivation SET items = ? WHERE room_id = ? AND wxid = ?').run(JSON.stringify(items), room_id, req.params.wxid);
    res.json({ success: true, message: `已移除 ${req.params.itemId}` });
  } catch (err) {
    console.error('[CultivationAdmin] DELETE /items error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Game Config (shop, pills, realms)
// ============================================================

/**
 * GET /api/plugins/cultivation/rooms — 获取所有有修仙记录的群
 */
router.get('/rooms', (req, res) => {
  try {
    const rows = db.prepare("SELECT DISTINCT room_id FROM cultivation WHERE room_id LIKE '%@chatroom%' ORDER BY room_id").all();
    const rooms = rows.map(r => {
      let displayName = '';
      try { displayName = wechat.getDisplayName(r.room_id) || ''; } catch {}
      const cnt = db.prepare('SELECT COUNT(*) as c FROM cultivation WHERE room_id = ?').get(r.room_id);
      return {
        room_id: r.room_id,
        display_name: displayName && displayName !== r.room_id ? displayName : '',
        user_count: cnt?.c || 0,
      };
    });
    res.json({ rooms });
  } catch (err) {
    console.error('[CultivationAdmin] GET /rooms error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/plugins/cultivation/config — 获取游戏配置
 */
router.get('/config', (req, res) => {
  res.json({
    realms: REALMS,
    breakthrough_costs: BREAKTHROUGH_COSTS,
    shop: getDBConfig('shop') || DEFAULT_SHOP,
    pills: getDBConfig('pills') || DEFAULT_PILLS,
    defaults: {
      shop: DEFAULT_SHOP,
      pills: DEFAULT_PILLS,
    },
  });
});

/**
 * PUT /api/plugins/cultivation/config/shop — 更新商店配置
 * Body: { items: [...] }
 */
router.put('/config/shop', (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items 必须是数组' });
    setDBConfig('shop', items);
    res.json({ success: true, message: '商店配置已更新' });
  } catch (err) {
    console.error('[CultivationAdmin] PUT /config/shop error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/plugins/cultivation/config/pills — 更新丹药配置
 * Body: { pills: {...} }
 */
router.put('/config/pills', (req, res) => {
  try {
    const { pills } = req.body;
    if (!pills || typeof pills !== 'object') return res.status(400).json({ error: 'pills 必须是对象' });
    setDBConfig('pills', pills);
    res.json({ success: true, message: '丹药配置已更新' });
  } catch (err) {
    console.error('[CultivationAdmin] PUT /config/pills error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
