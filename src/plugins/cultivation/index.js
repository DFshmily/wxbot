import db from '../../database/init.js';
import messageQueue from '../../services/message-queue.js';
import wechat from '../../services/wechatferry.js';

// ============================================================
// 凡人修仙传 · 插件
// ============================================================

// -------- 境界体系 --------
const REALMS = [
  { min: 0,     title: '🧘 练气初期',     realm: '练气期' },
  { min: 10,    title: '🧘 练气中期',     realm: '练气期' },
  { min: 50,    title: '🧘 练气后期',     realm: '练气期' },
  { min: 100,   title: '🏛 筑基初期',     realm: '筑基期' },
  { min: 200,   title: '🏛 筑基中期',     realm: '筑基期' },
  { min: 500,   title: '🏛 筑基后期',     realm: '筑基期' },
  { min: 1000,  title: '💎 结丹初期',     realm: '结丹期' },
  { min: 2000,  title: '💎 结丹中期',     realm: '结丹期' },
  { min: 5000,  title: '💎 结丹后期',     realm: '结丹期' },
  { min: 10000, title: '👁 元婴初期',     realm: '元婴期' },
  { min: 20000, title: '👁 元婴中期',     realm: '元婴期' },
  { min: 50000, title: '👁 元婴后期',     realm: '元婴期' },
  { min: 100000, title: '✨ 化神期·大能', realm: '化神期' },
];

function getRealm(messages) {
  return getRealmByIndex(getRealmIndexFromMessages(messages));
}

function getCultivationTitle(realmIdx) {
  return getRealmByIndex(realmIdx).title;
}

function getRealmByIndex(idx) {
  idx = Math.max(0, Math.min(idx, REALMS.length - 1));
  return { index: idx, ...REALMS[idx] };
}

function getRealmIndexFromMessages(messages) {
  let idx = 0;
  for (let i = 1; i < REALMS.length; i++) {
    if (messages >= REALMS[i].min) idx = i;
  }
  return idx;
}

// ---- 丹药 ----
const PILLS = {
  '聚气丹': { cost: 10, bonus: 0.10, desc: '突破成功率+10%' },
  '筑基丹': { cost: 50, bonus: 0.20, desc: '突破成功率+20%' },
  '凝碧丹': { cost: 100, bonus: 0.15, desc: '突破成功率+15%' },
  '结金丹': { cost: 200, bonus: 0.30, desc: '突破成功率+30%' },
  '天元丹': { cost: 300, bonus: 0.40, desc: '突破成功率+40%' },
  '渡劫丹': { cost: 500, bonus: 0.50, desc: '突破成功率+50%' },
};

// ---- 商店 ----
// 法器/法宝 (equipment) — 签到加成、斗法胜率、斗法减损、突破辅助
// 灵兽 (pet) — 签到加成、斗法胜率
// 功法 (technique) — 突破成功率、突破减损、斗法辅助
// 消耗品 (consumable) — 一次性斗法/突破神效
const SHOP_ITEMS = [
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

function getShopItems() {
  const row = db.prepare('SELECT value FROM plugin_config WHERE plugin = ? AND key = ?').get('cultivation', 'shop');
  return row ? JSON.parse(row.value) : SHOP_ITEMS;
}

function getPillsConfig() {
  const row = db.prepare('SELECT value FROM plugin_config WHERE plugin = ? AND key = ?').get('cultivation', 'pills');
  return row ? JSON.parse(row.value) : PILLS;
}

// ---- 工具函数 ----
function getItems(items) {
  if (!items || typeof items !== 'object') return { pills: {}, equipment: {}, pets: {}, techniques: {}, consumables: {} };
  const cats = { pills: {}, equipment: {}, pets: {}, techniques: {}, consumables: {} };
  for (const k of Object.keys(cats)) {
    if (items[k]) cats[k] = { ...items[k] };
  }
  return cats;
}

function getPassiveBonus(items, type) {
  const inv = getItems(items);
  let total = 0;
  for (const item of getShopItems()) {
    if (item.passive !== type) continue;
    const cat = item.type === 'pet' ? 'pets' : item.type === 'technique' ? 'techniques' : item.type === 'consumable' ? 'consumables' : 'equipment';
    if ((inv[cat]?.[item.id] || 0) > 0) total += item.passiveVal;
  }
  return total;
}

function hasConsumable(items, id) {
  const inv = getItems(items);
  return (inv.consumables?.[id] || 0) > 0;
}

function useConsumable(items, id) {
  const inv = getItems(items);
  if ((inv.consumables?.[id] || 0) > 0) {
    inv.consumables[id]--;
    if (inv.consumables[id] <= 0) delete inv.consumables[id];
  }
  return inv;
}

function getCultivationData(roomId, wxid) {
  let data = db.prepare('SELECT * FROM cultivation WHERE room_id = ? AND wxid = ?').get(roomId, wxid);
  if (!data) {
    const lvl = db.prepare('SELECT total_messages FROM user_levels WHERE room_id = ? AND wxid = ?').get(roomId, wxid);
    const initIdx = getRealmIndexFromMessages(lvl?.total_messages || 0);
    db.prepare(`INSERT INTO cultivation (room_id, wxid, spirit_stones, exp_pool, items, realm_idx) VALUES (?, ?, 0, 0, '{}', ?)`).run(roomId, wxid, initIdx);
    data = db.prepare('SELECT * FROM cultivation WHERE room_id = ? AND wxid = ?').get(roomId, wxid);
  }
  data.items = JSON.parse(data.items || '{}');
  if (data.realm_idx == null || data.realm_idx === -1) {
    const lvl = db.prepare('SELECT total_messages FROM user_levels WHERE room_id = ? AND wxid = ?').get(roomId, wxid);
    data.realm_idx = getRealmIndexFromMessages(lvl?.total_messages || 0);
    updateCultivation(roomId, wxid, { realm_idx: data.realm_idx });
  }
  // 默认精力值
  if (data.energy == null) {
    data.energy = MAX_ENERGY;
    try { updateCultivation(roomId, wxid, { energy: MAX_ENERGY }); } catch {}
  }
  return data;
}

function updateCultivation(roomId, wxid, updates) {
  const fields = [], values = [];
  for (const [k, v] of Object.entries(updates)) {
    fields.push(`${k} = ?`);
    values.push(k === 'items' ? JSON.stringify(v) : v);
  }
  values.push(roomId, wxid);
  db.prepare(`UPDATE cultivation SET ${fields.join(', ')} WHERE room_id = ? AND wxid = ?`).run(...values);
}

function getBreakthroughCost(idx) {
  return [10, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000][Math.min(idx, 11)];
}

function getBaseRate(idx) {
  return [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.35, 0.30, 0.25, 0.20, 0.15, 0.10][Math.min(idx, 11)];
}

// ============================================================
// 命令处理
// ============================================================

function handleShop(roomId, sender, category) {
  const shopItems = getShopItems();
  const pills = getPillsConfig();
  const cats = {
    '法器': shopItems.filter(s => s.type === 'equipment'),
    '灵兽': shopItems.filter(s => s.type === 'pet'),
    '功法': shopItems.filter(s => s.type === 'technique'),
    '消耗': shopItems.filter(s => s.type === 'consumable'),
    '丹药': Object.entries(pills).map(([n, i]) => ({ id: n, price: i.cost, desc: i.desc })),
  };

  if (category && cats[category]) {
    let r = `🏪 ${category}\n━━━━━━━━\n`;
    r += cats[category].map(i => `${i.id} · ${i.price}灵石\n→ ${i.desc}`).join('\n');
    messageQueue.enqueue(roomId, r);
    return;
  }

  let r = `🏪 天渊城·珍宝阁\n━━━━━━━━━━\n`;
  for (const [cn, ci] of Object.entries(cats)) {
    r += `\n── ${cn} ──\n`;
    r += ci.map(i => `  ${i.id} · ${i.price}灵石\n  → ${i.desc}`).join('\n');
  }
  r += `\n💡 购买: 购买 <物品名>\n💡 分类: 商店 法器/灵兽/功法/消耗/丹药`;
  messageQueue.enqueue(roomId, r);
}

function handleBuy(roomId, sender, rawArg, forceGift = false) {
  if (!rawArg) {
    const hint = forceGift ? '赠送 <物品名> @对方wxid' : '购买 <物品名> 或 购买 <物品名> @对方wxid(赠送)';
    messageQueue.enqueue(roomId, `⚠️ 用法: ${hint}`);
    return;
  }

  // Parse gift target from "@wxid" suffix
  let target = null;
  let itemName = rawArg;
  const atMatch = rawArg.match(/@(\S+)$/);
  if (atMatch) {
    target = atMatch[1];
    itemName = rawArg.replace(/@\S+$/, '').trim();
    if (!itemName) { messageQueue.enqueue(roomId, '⚠️ 请指定要购买的物品名'); return; }
    if (target === sender) { messageQueue.enqueue(roomId, '⚠️ 不能赠送给自己，直接购买即可'); return; }
  }

  // 赠送命令必须指定目标
  if (forceGift && !target) {
    messageQueue.enqueue(roomId, '⚠️ 赠送需要指定对方wxid，格式: 赠送 <物品名> @对方wxid');
    return;
  }

  const shopItems = getShopItems();
  const pills = getPillsConfig();
  const shopItem = shopItems.find(s => s.id.includes(itemName) || itemName.includes(s.id.slice(0, 4)));
  const pillItem = !shopItem ? Object.entries(pills).find(([n]) => itemName.includes(n)) : null;
  if (!shopItem && !pillItem) { messageQueue.enqueue(roomId, `⚠️ 没有"${itemName}"，发"商店"查看`); return; }

  const cult = getCultivationData(roomId, sender);
  const name = wechat.getDisplayName(sender);

  if (shopItem) {
    const isPermanent = ['equipment', 'pet', 'technique'].includes(shopItem.type);
    const cat = shopItem.type === 'pet' ? 'pets' : shopItem.type === 'technique' ? 'techniques' : shopItem.type === 'consumable' ? 'consumables' : 'equipment';

    // 自购永久物品检测重复
    if (isPermanent && !target) {
      const inv = getItems(cult.items);
      if ((inv[cat]?.[shopItem.id] || 0) > 0) {
        messageQueue.enqueue(roomId, `⚠️ 已拥有「${shopItem.id}」。如需赠送他人，请使用:\n购买 ${shopItem.id} @对方wxid`);
        return;
      }
    }

    // 灵石检查
    if ((cult.spirit_stones || 0) < shopItem.price) {
      messageQueue.enqueue(roomId, `⚠️ 需要 ${shopItem.price} 灵石，你只有 ${cult.spirit_stones}`);
      return;
    }

    if (target) {
      // ===== 赠送 =====
      const tCult = getCultivationData(roomId, target);
      const tName = wechat.getDisplayName(target);
      const tItems = getItems(tCult.items);
      if (isPermanent) {
        if ((tItems[cat]?.[shopItem.id] || 0) > 0) {
          messageQueue.enqueue(roomId, `⚠️ ${tName} 已拥有「${shopItem.id}」，无法赠送`);
          return;
        }
        tItems[cat][shopItem.id] = 1;
      } else {
        tItems[cat][shopItem.id] = (tItems[cat][shopItem.id] || 0) + 1;
      }
      updateCultivation(roomId, target, { items: tItems });
      updateCultivation(roomId, sender, { spirit_stones: (cult.spirit_stones || 0) - shopItem.price });
      messageQueue.enqueue(roomId, `🎁 ${name} 赠送「${shopItem.id}」给 ${tName}！💰 ${shopItem.price}灵石\n✨ ${shopItem.desc}`);
    } else {
      // ===== 自购 =====
      const items = getItems(cult.items);
      if (isPermanent) {
        items[cat][shopItem.id] = 1;
      } else {
        items[cat][shopItem.id] = (items[cat][shopItem.id] || 0) + 1;
      }
      updateCultivation(roomId, sender, { spirit_stones: (cult.spirit_stones || 0) - shopItem.price, items });
      const label = isPermanent ? '（已装备）' : '';
      messageQueue.enqueue(roomId, `🛒 ${name} 购得「${shopItem.id}」！💰 ${shopItem.price}灵石${label}\n✨ ${shopItem.desc}`);
    }
  } else if (pillItem) {
    const [pn, pi] = pillItem;
    const price = pi.cost * 2;
    if ((cult.spirit_stones || 0) < price) { messageQueue.enqueue(roomId, `⚠️ 需要 ${price} 灵石`); return; }
    const items = getItems(cult.items);
    items.pills[pn] = (items.pills[pn] || 0) + 1;
    updateCultivation(roomId, sender, { spirit_stones: (cult.spirit_stones || 0) - price, items });
    messageQueue.enqueue(roomId, `🛒 ${name} 购得 ${pn} x1（💰 ${price}灵石）\n💡 炼丹更便宜：炼丹 ${pn}`);
  }
}

function handleBackpack(roomId, sender) {
  const cult = getCultivationData(roomId, sender);
  const items = getItems(cult.items);
  const name = wechat.getDisplayName(sender);
  const shopItems = getShopItems();
  let r = `🎒 ${name} 的储物袋\n━━━━━━━━━━\n💰 灵石: ${cult.spirit_stones || 0}\n💫 修为: ${cult.exp_pool || 0}`;

  // 永久物品（法器/灵兽/功法）：显示效果说明
  for (const [label, key, icon] of [['法器', 'equipment', '⚔️'], ['灵兽', 'pets', '🐉'], ['功法', 'techniques', '📖']]) {
    const entries = Object.entries(items[key] || {}).filter(([, c]) => c > 0);
    if (entries.length) {
      r += `\n━━ ${label} ━━\n`;
      r += entries.map(([id]) => {
        const si = shopItems.find(s => s.id === id);
        return `${icon} ${id}\n  → ${si ? si.desc : '未知效果'}`;
      }).join('\n');
    }
  }

  // 消耗品（丹药/消耗品）：显示数量
  for (const [label, key, icon] of [['丹药', 'pills', '💊'], ['消耗品', 'consumables', '📜']]) {
    const entries = Object.entries(items[key] || {}).filter(([, c]) => c > 0);
    if (entries.length) {
      r += `\n━━ ${label} ━━\n`;
      r += entries.map(([id, c]) => `${icon} ${id} x${c}`).join('\n');
    }
  }
  if (Object.values(items).every(cat => Object.keys(cat).length === 0)) r += '\n📦 空空如也';
  messageQueue.enqueue(roomId, r);
}

function handleCultivate(roomId, sender, pillName) {
  const cult = getCultivationData(roomId, sender);
  const items = getItems(cult.items);
  const idx = cult.realm_idx;
  const realm = getRealmByIndex(idx);

  if (idx >= REALMS.length - 1) { messageQueue.enqueue(roomId, '👑 已达大乘圆满'); return; }
  const next = REALMS[idx + 1];
  const cost = getBreakthroughCost(idx);
  if ((cult.exp_pool || 0) < cost) {
    messageQueue.enqueue(roomId, `💪 突破「${next.title}」需要 ${cost} 修为，还差 ${cost - (cult.exp_pool || 0)}`);
    return;
  }

  // Auto-success from 天机符
  if (hasConsumable(cult.items, '天机符·一张')) {
    const newItems = useConsumable(cult.items, '天机符·一张');
    updateCultivation(roomId, sender, { exp_pool: (cult.exp_pool || 0) - cost, consecutive_fails: 0, realm_idx: (cult.realm_idx || 0) + 1, items: newItems });
    const name = wechat.getDisplayName(sender);
    let msg = `🎉 ${name} 使用天机符，逆天改命！\n━━━━━━━━━━\n${realm.title} → ${next.title}`;
    if (['筑基期', '结丹期', '元婴期', '化神期'].includes(next.realm)) msg += `\n✨ ${name}踏入${next.realm}，天地震动！`;
    messageQueue.enqueue(roomId, msg);
    return;
  }

  let bonus = 0, usedPill = null;
  const pills = getPillsConfig();
  if (pillName && pills[pillName]) {
    if ((items.pills[pillName] || 0) > 0) {
      bonus = pills[pillName].bonus; usedPill = pillName;
      items.pills[pillName]--; if (items.pills[pillName] <= 0) delete items.pills[pillName];
      updateCultivation(roomId, sender, { items });
    } else { messageQueue.enqueue(roomId, `⚠️ 没有${pillName}了`); return; }
  }

  const baseRate = getBaseRate(idx);
  const failBonus = Math.min((cult.consecutive_fails || 0) * 0.05, 0.30);
  const techBonus = getPassiveBonus(cult.items, 'breakthrough_rate');
  const totalRate = Math.min(baseRate + bonus + failBonus + techBonus, 0.95);
  const roll = Math.random();
  const name = wechat.getDisplayName(sender);

  if (roll < totalRate) {
    updateCultivation(roomId, sender, { exp_pool: (cult.exp_pool || 0) - cost, consecutive_fails: 0, realm_idx: (cult.realm_idx || 0) + 1 });
    let msg = `🎉 ${name} 突破成功！\n━━━━━━━━━━\n${realm.title} → ${next.title}`;
    if (usedPill) msg += `\n💊 服用${usedPill}`;
    if (techBonus) msg += `\n📖 功法加持+${(techBonus * 100).toFixed(0)}%`;
    msg += `\n📊 成功率: ${(totalRate * 100).toFixed(0)}%`;
    if (cult.consecutive_fails > 0) msg += `\n💪 历经${cult.consecutive_fails}次失败终获突破！`;
    if (['筑基期', '结丹期', '元婴期', '化神期'].includes(next.realm)) {
      msg += `\n✨ ${['天降异象！', '灵气涌动！', '从此仙凡有别！'][Math.floor(Math.random() * 3)]}`;
    }
    messageQueue.enqueue(roomId, msg);
  } else {
    const lossProtect = getPassiveBonus(cult.items, 'breakthrough_loss');
    const lostExp = Math.floor(cost * (lossProtect > 0 ? 0.15 : 0.30));
    updateCultivation(roomId, sender, { exp_pool: Math.max(0, (cult.exp_pool || 0) - lostExp), consecutive_fails: (cult.consecutive_fails || 0) + 1 });
    let msg = `😤 ${name} 突破失败！\n💔 消耗 ${lostExp} 修为\n📊 下次+${Math.min((cult.consecutive_fails + 1) * 5, 30)}%`;
    if (lossProtect > 0) msg += '\n🛡 三转重元功护体，损失减半！';
    messageQueue.enqueue(roomId, msg);
  }
}

function handleAlchemy(roomId, sender, pillName) {
  const pills = getPillsConfig();
  const pill = pills[pillName];
  if (!pill) {
    const list = Object.entries(pills).map(([n, i]) => `${n}: ${i.cost}灵石 — ${i.desc}`).join('\n');
    messageQueue.enqueue(roomId, `📖 可炼丹药:\n${list}\n\n用法: 炼丹 <丹药名>`);
    return;
  }
  const cult = getCultivationData(roomId, sender);
  if ((cult.spirit_stones || 0) < pill.cost) { messageQueue.enqueue(roomId, `⚠️ 炼丹需要 ${pill.cost} 灵石`); return; }
  const items = getItems(cult.items);
  items.pills[pillName] = (items.pills[pillName] || 0) + 1;
  updateCultivation(roomId, sender, { spirit_stones: (cult.spirit_stones || 0) - pill.cost, items });
  messageQueue.enqueue(roomId, `🔥 ${wechat.getDisplayName(sender)} 炼出 ${pillName} x1！💰 ${pill.cost}灵石`);
}

function handleDuel(roomId, sender, targetArg) {
  const cult = getCultivationData(roomId, sender);
  if ((cult.spirit_stones || 0) < 5) { messageQueue.enqueue(roomId, '⚠️ 斗法需要5灵石报名费'); return; }
  const realm = getRealmByIndex(cult.realm_idx);
  const idx = cult.realm_idx;
  const name = wechat.getDisplayName(sender);

  // Resolve target: if not specified, pick a random user from the room
  const targets = db.prepare(
    "SELECT wxid, realm_idx FROM cultivation WHERE room_id = ? AND wxid != ? AND (energy IS NULL OR energy > 0) LIMIT 10"
  ).all(roomId, sender);
  let tWxid, tIdx, tName;
  if (targetArg) {
    // Extract wxid from @wxid or direct wxid
    const cleanTarget = targetArg.replace(/^@/, '');
    const found = targets.find(t => t.wxid === cleanTarget);
    if (!found) {
      messageQueue.enqueue(roomId, `⚠️ ${cleanTarget} 不在本群修仙者中，或今日精力已尽无法应战`);
      return;
    }
    tWxid = found.wxid;
    tIdx = found.realm_idx;
  } else if (targets.length > 0) {
    const chosen = targets[Math.floor(Math.random() * targets.length)];
    tWxid = chosen.wxid;
    tIdx = chosen.realm_idx;
  } else {
    // No real targets — fight a random spirit beast
    tWxid = null;
    tIdx = Math.random() < 0.5 ? idx + 1 : Math.max(0, idx - 1);
    if (tIdx >= REALMS.length) tIdx = REALMS.length - 1;
  }
  tName = tWxid ? wechat.getDisplayName(tWxid) : '山中妖兽';
  const tRealm = getRealmByIndex(tIdx);

  // Check auto-win consumables (any duel_auto_win item)
  const autoWinItems = getShopItems().filter(s => s.passive === 'duel_auto_win');
  const ownedAutoWin = autoWinItems.find(s => hasConsumable(cult.items, s.id));
  if (ownedAutoWin) {
    const newItems = useConsumable(cult.items, ownedAutoWin.id);
    updateCultivation(roomId, sender, { spirit_stones: (cult.spirit_stones || 0) - 5 + 7, items: newItems });
    messageQueue.enqueue(roomId, `⚔️ ${name} 祭出${ownedAutoWin.id}，${tName}被瞬间压制！\n💰 +7灵石（${ownedAutoWin.id}已消耗）`);
    return;
  }

  // Normal duel
  let winRate = Math.max(0.15, Math.min(0.90, 0.5 + (idx - tIdx) * 0.10 + getPassiveBonus(cult.items, 'duel_win_rate')));

  if (Math.random() < winRate) {
    updateCultivation(roomId, sender, { spirit_stones: (cult.spirit_stones || 0) - 5 + 7 });
    messageQueue.enqueue(roomId, `⚔️ ${name} 斗法获胜！\n你(${realm.title}) VS ${tName}(${tRealm.title})\n📊 胜率 ${(winRate * 100).toFixed(0)}%\n💰 +7灵石`);
    // Winner gains 1 exp
    updateCultivation(roomId, sender, { exp_pool: (cult.exp_pool || 0) + 1 });
  } else {
    const loss = getPassiveBonus(cult.items, 'duel_loss_protect') > 0 ? 3 : 5;
    updateCultivation(roomId, sender, { spirit_stones: (cult.spirit_stones || 0) - loss });
    let msg = `💀 ${name} 斗法落败！\n你(${realm.title}) VS ${tName}(${tRealm.title})\n📊 胜率 ${(winRate * 100).toFixed(0)}%\n💰 -${loss}灵石`;
    if (loss < 5) msg += '\n🛡 防御法宝挡了部分伤害！';
    messageQueue.enqueue(roomId, msg);
  }
}

function handleMyLevel(roomId, sender) {
  const cult = getCultivationData(roomId, sender);
  const realm = getRealmByIndex(cult.realm_idx);
  const name = wechat.getDisplayName(sender);
  const nextR = REALMS[cult.realm_idx + 1];
  let r = `━━━ 凡人修仙 · ${name} ━━━\n📖 境界: ${realm.title}\n💫 修为: ${cult.exp_pool || 0}\n💰 灵石: ${cult.spirit_stones || 0}`;

  // 显示已装备的永久物品
  const items = getItems(cult.items);
  const equipped = [];
  for (const key of ['equipment', 'pets', 'techniques']) {
    for (const id of Object.keys(items[key] || {})) {
      if ((items[key][id] || 0) > 0) equipped.push(id);
    }
  }
  if (equipped.length) r += `\n🛡 已装备: ${equipped.join('、')}`;

  if (nextR) {
    const cost = getBreakthroughCost(cult.realm_idx);
    r += `\n🎯 下一境: ${nextR.title}\n💪 突破需 ${cost} 修为\n💡 发送「修炼」尝试突破`;
  } else {
    r += '\n🏆 已达大乘圆满！';
  }
  messageQueue.enqueue(roomId, r);
}

function handleRealmOverview(roomId, sender) {
  const cult = getCultivationData(roomId, sender);
  const curIdx = cult.realm_idx;
  let r = '━━━ 修仙道途 · 境界大全 ━━━\n';
  r += '   境界              所需修为  成功率\n';
  r += '  ─────────────────────────────\n';
  for (let i = 0; i < REALMS.length; i++) {
    const isCurrent = i === curIdx;
    const isReached = i <= curIdx;
    const cost = i < REALMS.length - 1 ? getBreakthroughCost(i) : 0;
    const rate = i < REALMS.length - 1 ? getBaseRate(i) : 0;
    const emoji = isCurrent ? '📍' : isReached ? '✅' : '  ';
    const marker = isCurrent ? ' ← 当前' : '';
    const progress = isReached && i < REALMS.length - 1
      ? ` (${cult.exp_pool || 0}/${cost})` : '';
    r += `${emoji} ${(REALMS[i].title + '      ').slice(0, 16)}`;
    if (i < REALMS.length - 1) {
      r += `${String(cost).padStart(6)}  ${(rate * 100).toFixed(0).padStart(2)}%`;
    } else {
      r += '  ────  圆满';
    }
    r += progress + marker + '\n';
  }
  r += '\n💡 发送「修炼」突破当前境界';
  messageQueue.enqueue(roomId, r);
}

/** 精力值上限 */
const MAX_ENERGY = 20;

function handlePets(roomId, sender) {
  const cult = getCultivationData(roomId, sender);
  const items = getItems(cult.items);
  const shopItems = getShopItems();
  const name = wechat.getDisplayName(sender);
  const pets = Object.entries(items.pets || {}).filter(([, c]) => c > 0);
  if (!pets.length) {
    messageQueue.enqueue(roomId, `🐉 ${name} 还没有灵兽，快去「商店 灵兽」购买吧`);
    return;
  }
  let r = `🐉 ${name} 的灵兽\n━━━━━━━━\n`;
  for (const [id] of pets) {
    const si = shopItems.find(s => s.id === id);
    r += `🐉 ${id}\n  → ${si ? si.desc : '未知灵兽，但已认主'}\n`;
  }
  r += '💡 灵兽已认主，自动提供助战效果';
  messageQueue.enqueue(roomId, r);
}

function handleGuide(roomId) {
  const guide = `━━━ 凡人修仙 · 攻略 ━━━

📖 三步上手
  💬 发消息 → 自动涨修为
  📊 我的修为 → 看进度
  🧘 修炼 → 突破境界

━━ 修为获取 ━━
💬 每条消息 +1
✅ 每天签到 +1
🗺 秘境探险 +3~10
⚔️ 斗法胜利 +1

━━ 灵石获取 ━━
✅ 签到 每日1~10+
🗺 探险 每次5~50
⚔️ 斗法胜利 +7

━━ 常用命令 ━━
📊 我的修为 — 个人状态
🗺 境界大全 — 13阶天梯图
🏪 商店 [分类] — 查看商品
🛒 购买 <名> — 买东西
🎒 储物袋 — 查看物品
🧘 修炼 [丹药] — 突破境界
🔥 炼丹 <名> — 半价炼药
⚔️ 斗法 [@xxx] — 修士对决
🗺 秘境/探险 — 寻宝（耗精力）
📊 境界排行 / 灵石榜 — 排名

💡 发「修仙攻略」或「修仙帮助」再看本指南`;
  messageQueue.enqueue(roomId, guide);
}

function handleLevelRanking(roomId) {
  const rows = db.prepare(`
    SELECT wxid, realm_idx, exp_pool
    FROM cultivation
    WHERE room_id = ? AND realm_idx IS NOT NULL
    ORDER BY realm_idx DESC, exp_pool DESC
    LIMIT 10
  `).all(roomId);
  if (!rows.length) { messageQueue.enqueue(roomId, '📊 此界尚无修士记载。'); return; }
  let r = '📊 境界排行榜\n━━━━━━━━\n';
  rows.forEach((row, i) => {
    const name = wechat.getDisplayName(row.wxid);
    const title = getCultivationTitle(row.realm_idx);
    r += `${['🥇', '🥈', '🥉'][i] || `  ${i + 1}.`} ${name}\n  ${title} (经验${row.exp_pool})\n`;
  });
  messageQueue.enqueue(roomId, r);
}

function handleStoneRanking(roomId) {
  const rows = db.prepare(`
    SELECT wxid, spirit_stones, realm_idx
    FROM cultivation
    WHERE room_id = ? ORDER BY spirit_stones DESC LIMIT 10
  `).all(roomId);
  if (!rows.length) { messageQueue.enqueue(roomId, '💰 此界尚无灵石记录。'); return; }
  let r = '💰 灵石排行榜\n━━━━━━━━\n';
  rows.forEach((row, i) => {
    const name = wechat.getDisplayName(row.wxid);
    const title = getCultivationTitle(row.realm_idx || 0);
    r += `${['🥇', '🥈', '🥉'][i] || `  ${i + 1}.`} ${name}\n  💰 ${row.spirit_stones}灵石 | ${title}\n`;
  });
  messageQueue.enqueue(roomId, r);
}

// ============================================================
// 秘境探险 & 精力系统
// ============================================================

/** 探险事件池（加权随机） */
const ADVENTURE_EVENTS = [
  { weight: 25, fn: (name) => ({
    msg: `🌿 ${name} 在密林中发现了一株百年灵药！小心翼翼采下，卖给了坊市。`,
    stoneChange: Math.floor(Math.random() * 10) + 5,
  })},
  { weight: 20, fn: (name) => ({
    msg: `⛰ ${name} 在一处隐蔽的山洞中找到了一些散落的灵石，看来是前人遗留。`,
    stoneChange: Math.floor(Math.random() * 15) + 10,
  })},
  { weight: 15, fn: (name) => ({
    msg: `⚔️ ${name} 遭遇了一头一级妖兽！一番激战后将其击退，在巢穴中发现了灵石。`,
    stoneChange: Math.floor(Math.random() * 20) + 15,
  })},
  { weight: 10, fn: (name) => ({
    msg: `🏛 ${name} 误入一处上古修士遗留的洞府！虽然禁制已残破，但仍有收获。`,
    stoneChange: Math.floor(Math.random() * 30) + 20,
    expChange: Math.floor(Math.random() * 8) + 3,
  })},
  { weight: 10, fn: (name, cult, pillsConfig) => {
    const pillNames = Object.keys(pillsConfig);
    if (!pillNames.length) return { msg: `🌿 ${name} 转了一圈，只采到几株普通草药。`, stoneChange: 3 };
    const pill = pillNames[Math.floor(Math.random() * pillNames.length)];
    return { msg: `💊 ${name} 在一座丹房的废墟中发现了一颗${pill}！虽然药效略有流失，但仍可服用。`, pillFound: pill, pillCount: 1 };
  }},
  { weight: 5, fn: (name, cult, pillsConfig, shopItems) => {
    const consumables = (shopItems || []).filter(s => s.type === 'consumable');
    if (!consumables.length) {
      return { msg: `✨ ${name} 遇到一位云游散修，得其指点，修为精进。`, expChange: Math.floor(Math.random() * 5) + 2 };
    }
    const item = consumables[Math.floor(Math.random() * consumables.length)];
    return { msg: `🎁 ${name} 救下一名受伤修士，对方感激涕零，赠予「${item.id}」作为报答！`, itemFound: item.id };
  }},
  { weight: 8, fn: (name) => ({
    msg: `💀 ${name} 太过冒进，误入毒瘴之地，中毒后花灵石买了解药才脱身。`,
    stoneChange: -Math.floor(Math.random() * 10) - 5,
  })},
  { weight: 7, fn: (name) => ({
    msg: `🕳 ${name} 踩中了一个捕兽陷阱！费了好大劲才挣脱，还弄丢了几块灵石。`,
    stoneChange: -Math.floor(Math.random() * 15) - 5,
  })},
];

function handleAdventure(roomId, sender) {
  const cult = getCultivationData(roomId, sender);
  const name = wechat.getDisplayName(sender);

  // 精力值检查
  const energy = cult.energy ?? MAX_ENERGY;
  if (energy <= 0) {
    messageQueue.enqueue(roomId, `😴 ${name} 今日精力已耗尽，休息一下明日再来吧。（每日回复 ${MAX_ENERGY} 点精力）`);
    return;
  }

  // 检查灵石
  if ((cult.spirit_stones || 0) < 5) {
    messageQueue.enqueue(roomId, `⚠️ ${name} 囊中羞涩，连5灵石路费都拿不出，无法探险。`);
    return;
  }

  // 加权随机抽取事件
  const totalWeight = ADVENTURE_EVENTS.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * totalWeight;
  let event = ADVENTURE_EVENTS[0];
  for (const e of ADVENTURE_EVENTS) {
    roll -= e.weight;
    if (roll <= 0) { event = e; break; }
  }

  const shopItems = getShopItems();
  const pillsConfig = getPillsConfig();
  const result = event.fn(name, cult, pillsConfig, shopItems);

  // 更新数据
  const updates = { spirit_stones: (cult.spirit_stones || 0) - 5, energy: energy - 1 };
  if (result.stoneChange) updates.spirit_stones += result.stoneChange;
  if (result.expChange) updates.exp_pool = (cult.exp_pool || 0) + result.expChange;

  let msg = `🗺 ${name} 踏入了秘境深处...\n━━━━━━━━━━\n${result.msg}`;
  msg += `\n\n💸 路费: -5灵石`;
  if (result.stoneChange > 0) msg += `\n💰 收获: +${result.stoneChange}灵石`;
  if (result.stoneChange < 0) msg += `\n💸 损失: ${result.stoneChange}灵石`;
  if (result.expChange) msg += `\n💫 感悟: +${result.expChange}修为`;
  msg += `\n⚡ 剩余精力: ${energy - 1}/${MAX_ENERGY}`;

  // 丹药/物品掉落
  if (result.pillFound) {
    const itemsData = getItems(cult.items);
    itemsData.pills[result.pillFound] = (itemsData.pills[result.pillFound] || 0) + (result.pillCount || 1);
    updates.items = itemsData;
    msg += `\n💊 获得丹药: ${result.pillFound}${result.pillCount > 1 ? ' x' + result.pillCount : ''}`;
  }
  if (result.itemFound) {
    const itemsData = getItems(cult.items);
    itemsData.consumables[result.itemFound] = (itemsData.consumables[result.itemFound] || 0) + 1;
    updates.items = itemsData;
    msg += `\n🎒 获得物品: ${result.itemFound}`;
  }

  updateCultivation(roomId, sender, updates);
  messageQueue.enqueue(roomId, msg);
}

// ============================================================
// 插件导出
// ============================================================

export default {
  name: '凡人修仙传',
  version: '1.0.0',
  description: '修仙游戏系统：境界、修炼、炼丹、斗法、商店',

  onLoad(ctx) {
    // Create game table
    db.exec(`
      CREATE TABLE IF NOT EXISTS cultivation (
        room_id TEXT NOT NULL,
        wxid TEXT NOT NULL,
        spirit_stones INTEGER NOT NULL DEFAULT 0,
        exp_pool INTEGER NOT NULL DEFAULT 0,
        consecutive_fails INTEGER NOT NULL DEFAULT 0,
        items TEXT NOT NULL DEFAULT '{}',
        last_breakthrough TEXT,
        PRIMARY KEY (room_id, wxid)
      );
    `);

    // Create plugin config table (for admin management - shop/pills config)
    db.exec(`
      CREATE TABLE IF NOT EXISTS plugin_config (
        plugin TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (plugin, key)
      );
    `);

    // Add energy columns (migration, safe to re-run)
    try { db.exec("ALTER TABLE cultivation ADD COLUMN energy INTEGER DEFAULT 20"); } catch { /* exists */ }
    try { db.exec("ALTER TABLE cultivation ADD COLUMN last_energy_date TEXT DEFAULT ''"); } catch { /* exists */ }

    // Register API for core (ai-chat)
    ctx.registerAPI('getCultivationInfo', (roomId, wxid) => {
      const cult = getCultivationData(roomId, wxid);
      const realm = getRealmByIndex(cult.realm_idx);
      const level = db.prepare('SELECT total_messages FROM user_levels WHERE room_id = ? AND wxid = ?').get(roomId, wxid);
      const nextRealm = REALMS[cult.realm_idx + 1];
      const nextCost = nextRealm ? getBreakthroughCost(cult.realm_idx) : 0;
      return {
        messages: level?.total_messages || 0,
        exp_pool: cult.exp_pool || 0,
        title: realm.title,
        realm: realm.realm,
        nextTitle: nextRealm?.title || null,
        expPoolNeeded: nextCost,
        energy: cult.energy ?? MAX_ENERGY,
        maxEnergy: MAX_ENERGY,
      };
    });
    ctx.registerAPI('getCultivationTitle', getCultivationTitle);

    // Listen for checkin events — reward spirit stones + refill energy
    ctx.on('checkin', ({ roomId, wxid, streak }) => {
      try {
        const cult = this._getCultData(roomId, wxid);
        const equipBonus = getPassiveBonus(cult.items, 'checkin_bonus');
        const reward = Math.floor(Math.random() * 10) + 1 + streak + equipBonus;

        // Refill daily energy on first checkin of the day
        const today = new Date().toISOString().slice(0, 10);
        let energyRefilled = false;
        if (cult.last_energy_date !== today) {
          refillEnergy(roomId, wxid);
          energyRefilled = true;
        }

        updateCultivation(roomId, wxid, {
          spirit_stones: (cult.spirit_stones || 0) + reward,
          exp_pool: (cult.exp_pool || 0) + 1,
        });
        return { stoneReward: reward, equipBonus, energyRefilled }; // signal back to checkin handler
      } catch { return null; }
    });

    // Listen for message events — accumulate exp
    ctx.on('message', ({ roomId, wxid }) => {
      try {
        const cult = this._getCultData(roomId, wxid);
        updateCultivation(roomId, wxid, { exp_pool: (cult.exp_pool || 0) + 1 });
      } catch { /* ignore */ }
    });

    // Migrate: add realm_idx column and initialize from total_messages
    try {
      db.exec("ALTER TABLE cultivation ADD COLUMN realm_idx INTEGER DEFAULT -1");
      const toMigrate = db.prepare("SELECT room_id, wxid FROM cultivation WHERE realm_idx = -1").all();
      for (const row of toMigrate) {
        const lvl = db.prepare("SELECT total_messages FROM user_levels WHERE room_id = ? AND wxid = ?").get(row.room_id, row.wxid);
        const idx = getRealmIndexFromMessages(lvl?.total_messages || 0);
        db.prepare("UPDATE cultivation SET realm_idx = ? WHERE room_id = ? AND wxid = ?").run(idx, row.room_id, row.wxid);
      }
    } catch { /* column already exists */ }

    console.log('[Cultivation] Plugin loaded');
  },

  // Store ref for internal use
  _getCultData(roomId, wxid) {
    let data = db.prepare('SELECT * FROM cultivation WHERE room_id = ? AND wxid = ?').get(roomId, wxid);
    if (!data) {
      const lvl = db.prepare('SELECT total_messages FROM user_levels WHERE room_id = ? AND wxid = ?').get(roomId, wxid);
      const initIdx = getRealmIndexFromMessages(lvl?.total_messages || 0);
      db.prepare(`INSERT INTO cultivation (room_id, wxid, spirit_stones, exp_pool, items, realm_idx) VALUES (?, ?, 0, 0, '{}', ?)`).run(roomId, wxid, initIdx);
      data = db.prepare('SELECT * FROM cultivation WHERE room_id = ? AND wxid = ?').get(roomId, wxid);
    }
    data.items = JSON.parse(data.items || '{}');
    if (data.realm_idx == null || data.realm_idx === -1) {
      const lvl = db.prepare('SELECT total_messages FROM user_levels WHERE room_id = ? AND wxid = ?').get(roomId, wxid);
      data.realm_idx = getRealmIndexFromMessages(lvl?.total_messages || 0);
      db.prepare("UPDATE cultivation SET realm_idx = ? WHERE room_id = ? AND wxid = ?").run(data.realm_idx, roomId, wxid);
    }
    return data;
  },

  handleMessage({ roomId, sender, content }) {
    const t = content.trim();

    // Exact match commands
    const exactCommands = {
      '我的修为': () => handleMyLevel(roomId, sender),
      '我的等级': () => handleMyLevel(roomId, sender),
      '境界大全': () => handleRealmOverview(roomId, sender),
      '道途': () => handleRealmOverview(roomId, sender),
      '修仙指南': () => handleRealmOverview(roomId, sender),
      '修仙帮助': () => handleGuide(roomId),
      '修仙攻略': () => handleGuide(roomId),
      '境界排行': () => handleLevelRanking(roomId),
      '境界排行榜': () => handleLevelRanking(roomId),
      '等级排行': () => handleLevelRanking(roomId),
      '等级排行榜': () => handleLevelRanking(roomId),
      '背包': () => handleBackpack(roomId, sender),
      '储物袋': () => handleBackpack(roomId, sender),
      '商店': () => handleShop(roomId, sender),
      '店铺': () => handleShop(roomId, sender),
      '珍宝阁': () => handleShop(roomId, sender),
      '秘境': () => handleAdventure(roomId, sender),
      '探险': () => handleAdventure(roomId, sender),
      '灵石排行': () => handleStoneRanking(roomId),
      '灵石榜': () => handleStoneRanking(roomId),
      '灵兽': () => handlePets(roomId, sender),
      '我的灵兽': () => handlePets(roomId, sender),
      '修炼': () => handleCultivate(roomId, sender),
    };

    if (exactCommands[t]) { exactCommands[t](); return true; }

    // Prefix commands
    if (t.startsWith('商店 ') || t.startsWith('店铺 ')) {
      handleShop(roomId, sender, t.replace(/^(商店|店铺)\s*/, '').trim());
      return true;
    }
    if (t.startsWith('购买 ') || t.startsWith('买 ')) {
      handleBuy(roomId, sender, t.replace(/^(购买|买)\s*/, '').trim());
      return true;
    }
    if (t.startsWith('赠送 ') || t.startsWith('送 ')) {
      handleBuy(roomId, sender, t.replace(/^(赠送|送)\s*/, '').trim(), true);
      return true;
    }
    if (t.startsWith('修炼 ')) {
      handleCultivate(roomId, sender, t.slice(3).trim());
      return true;
    }
    if (t.startsWith('炼丹 ')) {
      handleAlchemy(roomId, sender, t.slice(3).trim());
      return true;
    }
    if (t.startsWith('斗法 ') || t.startsWith('决斗 ')) {
      handleDuel(roomId, sender, t.replace(/^(斗法|决斗)\s*/, '').trim());
      return true;
    }

    return false; // not handled
  },

  getHelpLines() {
    return [
      '📖 修仙帮助 / 修仙攻略 — 完整玩法指南',
      '👤 我的修为 / 我的等级 — 查看修仙境界',
      '🗺 境界大全 / 道途 — 完整境界天梯图',
      '📊 境界排行 / 境界排行榜 — 境界排名',
      '🏪 商店 / 店铺 — 珍宝阁购物',
      '🛒 购买 <物品名> — 购买法器/灵兽/功法',
      '🎁 赠送 <物品名> @wxid — 购买并赠送给他人',
      '🎒 储物袋 — 查看灵石与装备物品',
      '🐉 灵兽 / 我的灵兽 — 查看灵兽状态',
      '💰 灵石排行 / 灵石榜 — 灵石排行榜',
      '🗺 秘境 / 探险 — 探索秘境获机缘（消耗精力）',
      '🧘 修炼 [丹药名] — 尝试突破境界',
      '🔥 炼丹 <丹药名> — 炼制丹药',
      '⚔️ 斗法 <@xxx或wxid> — 与人斗法夺灵石',
    ];
  },

  apis: {
    getCultivationInfo: null, // filled in onLoad
    getCultivationTitle: null, // filled in onLoad
  },
};
