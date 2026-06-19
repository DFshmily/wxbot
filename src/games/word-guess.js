import { chat } from '../services/deepseek.js';
import messageQueue from '../services/message-queue.js';

/**
 * 猜词游戏 / 你画我猜（文字版）
 * AI出题和给提示，群友猜词
 */

const WORD_CATEGORIES = ['动物', '食物', '职业', '运动', '物品', '成语', '电影', '地名', '名人', '动漫'];

const WORD_POOL = {
  '动物': ['企鹅', '长颈鹿', '考拉', '海豚', '熊猫', '变色龙', '猫头鹰', '螃蟹', '蜗牛', '孔雀'],
  '食物': ['火锅', '冰淇淋', '臭豆腐', '月饼', '螺蛳粉', '糖葫芦', '麻辣烫', '煎饼果子', '奶茶', '酸菜鱼'],
  '职业': ['程序员', '厨师', '飞行员', '侦探', '魔术师', '消防员', '理发师', '记者', '考古学家', '宇航员'],
  '运动': ['跳水', '举重', '蹦极', '滑雪', '拳击', '射箭', '花样滑冰', '马拉松', '攀岩', '击剑'],
  '物品': ['望远镜', '沙漏', '指南针', '风筝', '蜡烛', '橡皮筋', '降落伞', '水龙头', '订书机', '放大镜'],
  '成语': ['画蛇添足', '守株待兔', '掩耳盗铃', '井底之蛙', '对牛弹琴', '亡羊补牢', '刻舟求剑', '叶公好龙', '狐假虎威', '杯弓蛇影'],
  '电影': ['泰坦尼克号', '功夫', '西游记', '哈利波特', '千与千寻', '让子弹飞', '黑客帝国', '大话西游', '疯狂的石头', '无间道'],
  '地名': ['长城', '埃菲尔铁塔', '金字塔', '大本钟', '富士山', '自由女神像', '悉尼歌剧院', '兵马俑', '比萨斜塔', '卢浮宫'],
};

// Room games
const games = {};

export function handleWordGuessStart(roomId, sender, content) {
  if (games[roomId]) {
    messageQueue.enqueue(roomId, '⚠️ 猜词游戏已在进行中！');
    return;
  }

  // Parse category if provided
  const args = content.replace(/^猜词/, '').trim();
  let category = null;
  if (args) {
    const found = WORD_CATEGORIES.find(c => args.includes(c));
    if (found) category = found;
  }

  let word;
  if (category && WORD_POOL[category]) {
    const pool = WORD_POOL[category];
    word = pool[Math.floor(Math.random() * pool.length)];
  } else {
    // Random category + word
    const cats = Object.keys(WORD_POOL);
    const cat = cats[Math.floor(Math.random() * cats.length)];
    const pool = WORD_POOL[cat];
    word = pool[Math.floor(Math.random() * pool.length)];
    category = cat;
  }

  // Mask the word
  const masked = word.replace(/./g, '■');

  games[roomId] = {
    word,
    category,
    masked,
    hints: [],
    hintCount: 0,
    attempts: 0,
    maxAttempts: 15,
    maxHints: 3,
    phase: 'playing', // playing | ended
    startTime: Date.now(),
    creator: sender,
    guessedBy: null,
  };

  messageQueue.enqueue(roomId, `🎯 猜词游戏开始！
━━━━━━━━━━━━━━
📖 规则：我会给出提示，大家猜是什么词
📂 类别: ${category}
🔤 字数: ${word.length}字

${masked}

💡 回复"提示"可以获取线索
🎯 回复"猜 xxx"来猜答案`);
}

/**
 * Give a hint
 */
export async function handleWordGuessHint(roomId) {
  const game = games[roomId];
  if (!game || game.phase === 'ended') {
    messageQueue.enqueue(roomId, '⚠️ 当前没有进行中的猜词游戏。');
    return;
  }

  if (game.hintCount >= game.maxHints) {
    messageQueue.enqueue(roomId, '⚠️ 提示已达上限！再猜不到就公布答案了。');
    return;
  }

  game.hintCount++;

  try {
    const result = await chat(
      `词语是"${game.word}"（类别: ${game.category}）。请给出第${game.hintCount}个提示，不要直接说出这个词。提示要越来越明显。`,
      '你是一个猜词游戏的提示助手。每条提示不超过15字。'
    );

    const hint = result || '（没有更多提示了）';
    game.hints.push(hint);

    // Reveal some characters
    const revealed = revealChars(game.word, game.hintCount);
    game.masked = revealed;

    messageQueue.enqueue(roomId, `💡 提示${game.hintCount}: ${hint}
🔤 ${revealed}`);
  } catch {
    // Offline fallback hints
    const fallbackHints = [
      `类别是${game.category}`,
      `这个词有${game.word.length}个字`,
      `第一个字是"${game.word[0]}"`,
      `最后一个字是"${game.word[game.word.length - 1]}"`,
    ];
    const hint = game.hintCount <= fallbackHints.length
      ? fallbackHints[game.hintCount - 1]
      : '（没有更多提示了）';

    game.hints.push(hint);
    const revealed = revealChars(game.word, game.hintCount);
    game.masked = revealed;
    messageQueue.enqueue(roomId, `💡 提示${game.hintCount}: ${hint}
🔤 ${revealed}`);
  }
}

function revealChars(word, hintCount) {
  const chars = word.split('');
  const totalChars = chars.length;
  const revealCount = Math.min(Math.ceil(totalChars * 0.3 * hintCount), totalChars - 1);

  // Reveal characters randomly
  const indices = Array.from({ length: totalChars }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const revealed = new Set(indices.slice(0, revealCount));
  return chars.map((c, i) => revealed.has(i) ? c : '■').join('');
}

/**
 * Handle a guess
 */
export function handleWordGuess(roomId, sender, guess) {
  const game = games[roomId];
  if (!game || game.phase === 'ended') {
    return false;
  }

  game.attempts++;

  if (guess === game.word) {
    // Correct!
    const elapsed = Math.round((Date.now() - game.startTime) / 1000);
    game.phase = 'ended';
    game.guessedBy = sender;

    messageQueue.enqueue(roomId, `🎉 恭喜 @${sender} 猜对了！
答案是: 「${game.word}」
━━━━━━━━━━
⏱ 用时: ${elapsed}秒
💡 用了${game.hintCount}个提示
🔢 尝试了${game.attempts}次（包含错误猜测）
👏 太棒了！`);
    delete games[roomId];
    return true;
  }

  if (game.attempts >= game.maxAttempts) {
    game.phase = 'ended';
    messageQueue.enqueue(roomId, `⌛ 次数用完了！答案是: 「${game.word}」
没关系，下次加油！💪`);
    delete games[roomId];
    return true;
  }

  // Wrong guess
  const remaining = game.maxAttempts - game.attempts;
  messageQueue.enqueue(roomId, `❌ 不对哦！还剩 ${remaining} 次机会
🔤 ${game.masked}`);
  return true;
}

/**
 * Give up
 */
export function handleWordGuessGiveUp(roomId) {
  const game = games[roomId];
  if (!game) {
    messageQueue.enqueue(roomId, '⚠️ 当前没有进行中的猜词游戏。');
    return;
  }

  game.phase = 'ended';
  messageQueue.enqueue(roomId, `😅 放弃了？答案是: 「${game.word}」
下次加油！💪`);
  delete games[roomId];
}

export { WORD_POOL, WORD_CATEGORIES };
