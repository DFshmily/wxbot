import db from '../database/init.js';
import messageQueue from '../services/message-queue.js';

/**
 * Simplified idiom chain game — per doc §5.2.
 * Node validates rules, AI explains results (optional).
 *
 * Simplified: checks that the idiom starts with the last character
 * of the previous idiom. Uses a basic internal dictionary for validation.
 */

const IDIOM_DB = [
  '一心一意', '意气风发', '发扬光大', '大公无私', '私心杂念',
  '念念不忘', '忘恩负义', '义不容辞', '辞旧迎新', '新陈代谢',
  '谢天谢地', '地大物博', '博古通今', '今非昔比', '比比皆是',
  '事半功倍', '背道而驰', '持之以恒', '横冲直撞', '壮志凌云',
];

function getState(roomId) {
  const stmt = db.prepare(
    "SELECT * FROM game_state WHERE room_id = ? AND game_type = 'idiom'"
  );
  let state = stmt.get(roomId);
  if (!state) {
    return { active: false, chain: [], lastChar: '' };
  }
  return { ...JSON.parse(state.state), active: state.state.active };
}

function saveState(roomId, state) {
  const data = JSON.stringify(state);
  const existing = db.prepare(
    "SELECT id FROM game_state WHERE room_id = ? AND game_type = 'idiom'"
  ).get(roomId);

  if (existing) {
    db.prepare(
      "UPDATE game_state SET state = ?, updated_at = datetime('now','localtime') WHERE room_id = ? AND game_type = 'idiom'"
    ).run(data, roomId);
  } else {
    db.prepare(
      "INSERT INTO game_state (room_id, user, game_type, state) VALUES (?, '', 'idiom', ?)"
    ).run(roomId, data);
  }
}

function isValidIdiom(word) {
  return IDIOM_DB.includes(word);
}

export async function handleIdiomGame(roomId, sender, action, word) {
  const state = getState(roomId);

  if (action === 'start') {
    const start = '一心一意';
    state.active = true;
    state.chain = [start];
    state.lastChar = start.slice(-1);
    saveState(roomId, state);
    messageQueue.enqueue(roomId,
      `🔤 成语接龙开始！\n我先来：${start}\n请接 "${state.lastChar}" 开头的成语\n（输入成语即可，输入 $结束 结束游戏）`
    );
    return;
  }

  if (!state.active) {
    messageQueue.enqueue(roomId, '当前没有进行中的成语接龙，输入 $成语接龙 开始新游戏。');
    return;
  }

  if (action === 'end') {
    state.active = false;
    saveState(roomId, state);
    messageQueue.enqueue(roomId, `游戏结束，共接 ${state.chain.length} 个成语！`);
    return;
  }

  // Validate
  const firstChar = word[0];
  if (firstChar !== state.lastChar) {
    messageQueue.enqueue(roomId, `请用 "${state.lastChar}" 开头的成语！`);
    return;
  }

  if (!isValidIdiom(word)) {
    // Allow unrecognized idioms — just warn
    messageQueue.enqueue(roomId, `⚠️ "${word}" 不在词库中，但接龙继续。`);
  }

  state.chain.push(word);
  state.lastChar = word.slice(-1);
  saveState(roomId, state);

  messageQueue.enqueue(roomId, `✅ ${word}\n请接 "${state.lastChar}" 开头的成语`);
}
