import db from '../database/init.js';
import messageQueue from '../services/message-queue.js';
import { gameAction } from '../services/deepseek.js';

/**
 * Guess number game — per doc §5.1.
 * Group-level state, Node controls logic, AI assists with hints.
 */
const MAX_NUMBER = 100;

function getState(roomId) {
  const stmt = db.prepare(
    "SELECT * FROM game_state WHERE room_id = ? AND game_type = 'guess'"
  );
  let state = stmt.get(roomId);
  if (!state) {
    const target = Math.floor(Math.random() * MAX_NUMBER) + 1;
    const insert = db.prepare(
      "INSERT INTO game_state (room_id, user, game_type, state) VALUES (?, ?, 'guess', ?)"
    );
    insert.run(roomId, '', JSON.stringify({ target, attempts: 0, active: false }));
    state = { room_id: roomId, state: JSON.stringify({ target, attempts: 0, active: false }) };
  }
  return JSON.parse(state.state);
}

function saveState(roomId, state) {
  db.prepare(
    "UPDATE game_state SET state = ?, updated_at = datetime('now','localtime') WHERE room_id = ? AND game_type = 'guess'"
  ).run(JSON.stringify(state), roomId);
}

export async function handleGuessGame(roomId, sender, action, guess) {
  const state = getState(roomId);

  if (action === 'start') {
    state.target = Math.floor(Math.random() * MAX_NUMBER) + 1;
    state.attempts = 0;
    state.active = true;
    saveState(roomId, state);
    messageQueue.enqueue(roomId, `🔢 猜数字游戏开始！我已经想好了一个1-${MAX_NUMBER}之间的数字。\n输入 $猜数字 [数字] 来猜吧！`);
    return;
  }

  if (action === 'guess') {
    if (!state.active) {
      messageQueue.enqueue(roomId, '当前没有进行中的猜数字游戏，输入 $猜数字 开始新游戏。');
      return;
    }

    const num = parseInt(guess);
    if (isNaN(num) || num < 1 || num > MAX_NUMBER) {
      messageQueue.enqueue(roomId, `请输入1-${MAX_NUMBER}之间的数字。`);
      return;
    }

    state.attempts++;
    let reply;
    if (num === state.target) {
      state.active = false;
      saveState(roomId, state);
      reply = `🎉 恭喜猜中！答案就是 ${state.target}，一共猜了 ${state.attempts} 次！`;
    } else if (num < state.target) {
      reply = `小了，再大一点 (已猜${state.attempts}次)`;
      saveState(roomId, state);
    } else {
      reply = `大了，再小一点 (已猜${state.attempts}次)`;
      saveState(roomId, state);
    }

    messageQueue.enqueue(roomId, reply);
  }
}
