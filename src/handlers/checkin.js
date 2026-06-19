import messageQueue from '../services/message-queue.js';
import {
  hasCheckedIn, saveCheckin, getCheckinRanking,
  getUserCheckinDays, getConsecutiveCheckinDays,
} from '../database/queries.js';
import wechat from '../services/wechatferry.js';
import pluginManager from '../plugins/manager.js';

/**
 * Make a visual progress bar
 */
function makeProgressBar(current, max) {
  if (!max) return '';
  const total = 20;
  const filled = Math.min(Math.round((current / max) * total), total);
  return '▰'.repeat(filled) + '▱'.repeat(total - filled) + ` ${Math.min(Math.round((current / max) * 100), 100)}%`;
}

/**
 * 签到处理 — 记录签到并通知插件（如修仙插件会奖励灵石）
 */
export function handleCheckin(roomId, wxid) {
  const name = wechat.getDisplayName(wxid);

  if (hasCheckedIn(roomId, wxid)) {
    const streak = getConsecutiveCheckinDays(roomId, wxid);
    const total = getUserCheckinDays(roomId, wxid);
    messageQueue.enqueue(roomId, `⚠️ ${name} 今日已签到！\n🔥 连续签到 ${streak} 天 | 累计 ${total} 天`);
    return;
  }

  saveCheckin(roomId, wxid);
  const streak = getConsecutiveCheckinDays(roomId, wxid);
  const total = getUserCheckinDays(roomId, wxid);

  // Notify plugins (cultivation plugin gives spirit stones)
  pluginManager.emit('checkin', { roomId, wxid, name, streak, total });

  // Check if cultivation plugin is loaded — show cultivation-enhanced reply
  const cultInfo = pluginManager.callAPI('getCultivationInfo', roomId, wxid);
  let reply;
  if (cultInfo) {
    const msg = ['灵气入体，修为精进！', '大道可期！', '今日签到，如饮琼浆！',
      '距离飞升又近了一步！', '道心稳固，可喜可贺！', '签到如修炼，贵在坚持！'
    ][Math.floor(Math.random() * 6)];
    const progressBar = cultInfo.expPoolNeeded ? `\n${makeProgressBar(cultInfo.exp_pool, cultInfo.expPoolNeeded)}` : '';
    reply = `✅ ${name} 签到成功！\n━━━━━━━━━━\n📖 境界: ${cultInfo.title}\n`;
    if (progressBar) reply += `📊 修为: ${cultInfo.exp_pool}/${cultInfo.expPoolNeeded}${progressBar}\n`;
    reply += `💬 道行: ${cultInfo.messages} 条\n⚡ 精力: ${cultInfo.energy ?? 0}/${cultInfo.maxEnergy ?? 20}\n`;
    reply += `🔥 连续签到 ${streak} 天 | 累计 ${total} 天\n${msg}`;
  } else {
    reply = `✅ ${name} 签到成功！\n━━━━━━━━━━\n🔥 连续签到 ${streak} 天 | 累计 ${total} 天`;
  }

  // Milestone messages
  if (streak === 7) reply += '\n🎉 七日连签，小有所成！';
  if (streak === 30) reply += '\n🏆 三十日满勤，筑基有望！';
  if (streak === 100) reply += '\n👑 百日连签，金丹可期！';
  if (streak === 365) reply += '\n🎊 一年全勤！此乃大乘之资！！！';

  messageQueue.enqueue(roomId, reply);
}

/**
 * 签到排行榜
 */
export function handleCheckinRanking(roomId) {
  const ranking = getCheckinRanking(roomId, 10);
  if (!ranking.length) {
    messageQueue.enqueue(roomId, '📋 还没有人签过到，快来当第一个！');
    return;
  }

  let reply = '📋 签到排行榜\n━━━━━━━━━━\n';
  ranking.forEach((r, i) => {
    const name = wechat.getDisplayName(r.wxid);
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `  ${i + 1}.`;
    reply += `${medal} ${name} — ${r.days}天\n`;
  });
  messageQueue.enqueue(roomId, reply);
}
