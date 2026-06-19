import db from '../database/init.js';
import messageQueue from '../services/message-queue.js';

/**
 * 谁是卧底游戏
 * 一人拿到不同的词（卧底），其他人都是相同词。通过描述找出卧底。
 */

// 词库 — [平民词, 卧底词]
const WORD_PAIRS = [
  ['苹果', '梨'],
  ['西瓜', '哈密瓜'],
  ['土豆', '芋头'],
  ['牛奶', '豆浆'],
  ['面包', '蛋糕'],
  ['钢笔', '铅笔'],
  ['沙发', '躺椅'],
  ['围巾', '领带'],
  ['眼镜', '墨镜'],
  ['火车', '高铁'],
  ['自行车', '电动车'],
  ['手机', '平板'],
  ['电脑', '计算器'],
  ['书本', '杂志'],
  ['教室', '图书馆'],
  ['公园', '花园'],
  ['电视', '投影仪'],
  ['冰箱', '冰柜'],
  ['风扇', '空调'],
  ['雨伞', '雨衣'],
  ['袜子', '手套'],
  ['拖鞋', '凉鞋'],
  ['枕头', '抱枕'],
  ['火锅', '麻辣烫'],
  ['烧烤', '油炸'],
  ['奶茶', '咖啡'],
  ['蛋糕', '面包'],
  ['饺子', '馄饨'],
  ['米饭', '面条'],
  ['篮球', '排球'],
];

// Room game state
const games = {};

function getGame(roomId) {
  return games[roomId];
}

function getWordPair() {
  return WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
}

/**
 * Start a game of 谁是卧底
 */
export function handleUndercoverStart(roomId, sender, content) {
  if (games[roomId]) {
    messageQueue.enqueue(roomId, '⚠️ 游戏已在进行中，请先结束当前游戏（发送"结束卧底"）');
    return;
  }

  // Check if players are specified
  const args = content.replace(/^卧底|^谁是卧底/, '').trim();
  let players = [];
  if (args) {
    // Parse @mentions or comma-separated names
    const mentions = [...args.matchAll(/@([^\s\p{Cf}]+)/ug)].map(m => m[1]);
    if (mentions.length >= 3) {
      players = mentions;
    }
  }

  const [commonWord, spyWord] = getWordPair();

  games[roomId] = {
    phase: 'joining',  // joining | describing | voting | ended
    commonWord,
    spyWord,
    players,
    spyIndex: -1,
    currentDescriber: -1,
    descriptionOrder: [],
    votes: {},
    descriptions: {},
    round: 0,
    creator: sender,
  };

  const joinCode = `卧底 ${players.length > 0 ? '已指定玩家' : '请输入"加入卧底"报名'}`;

  if (players.length > 0) {
    // Players specified — assign roles immediately
    assignRoles(roomId);
  }

  messageQueue.enqueue(roomId, `🎭 谁是卧底开始！
━━━━━━━━━━━━━━
📖 规则：
1. 每个玩家会收到一个词（私信发给每人）
2. 大部分人是同一个词，卧底拿到的是不同的词
3. 每轮大家轮流用一句话描述自己的词（不能直接说出那个词）
4. 描述完后投票淘汰一个人
5. 卧底撑到最后则卧底赢，否则平民赢

${players.length > 0 ? `👥 玩家: ${players.map((p, i) => `${i + 1}. ${p}`).join(' / ')}` : '👥 请回复"加入卧底"报名'}`);
}

/**
 * Join game
 */
export function handleUndercoverJoin(roomId, sender) {
  const game = getGame(roomId);
  if (!game || game.phase !== 'joining') {
    messageQueue.enqueue(roomId, '⚠️ 当前没有等待加入的卧底游戏。');
    return;
  }

  if (game.players.includes(sender)) {
    messageQueue.enqueue(roomId, '⚠️ 你已经加入了！');
    return;
  }

  game.players.push(sender);
  messageQueue.enqueue(roomId, `✅ 已加入！当前共 ${game.players.length} 人\n至少需要3人，满员后发送"开始游戏"`);

  if (game.players.length >= 8) {
    messageQueue.enqueue(roomId, '👥 已满员！开始分配角色……');
    assignRoles(roomId);
  }
}

/**
 * Assign roles and start game
 */
function assignRoles(roomId) {
  const game = getGame(roomId);
  if (!game || game.players.length < 3) {
    messageQueue.enqueue(roomId, '⚠️ 至少需要3人才能开始游戏。');
    delete games[roomId];
    return;
  }

  // Select spy randomly
  game.spyIndex = Math.floor(Math.random() * game.players.length);
  game.phase = 'describing';
  game.round = 1;
  game.descriptionOrder = [...game.players];
  game.descriptions = {};
  game.votes = {};

  // Send words to each player privately (via group message with @mention)
  // For now, send in group since we can't DM easily
  let msg = `🎭 角色分配完毕！\n请查看你的词：\n\n`;
  game.players.forEach((p, i) => {
    const word = i === game.spyIndex ? game.spyWord : game.commonWord;
    msg += `@${p}: 你的词是 —— 「${word}」\n`;
  });
  msg += `\n📢 每人用一句话描述你的词（不能直接说出那个词）\n`;
  msg += `💡 ${game.descriptionOrder[0]} 你先来描述！`;

  messageQueue.enqueue(roomId, msg);
  game.currentDescriber = 0;
}

/**
 * Player submits a description
 */
export function handleUndercoverDescribe(roomId, sender, description) {
  const game = getGame(roomId);
  if (!game || game.phase !== 'describing') return false;

  const descIdx = game.descriptionOrder.indexOf(sender);
  if (descIdx < 0) return false;
  if (descIdx !== game.currentDescriber) {
    messageQueue.enqueue(roomId, `⏳ 还没轮到你，请等待 ${game.descriptionOrder[game.currentDescriber]} 描述。`);
    return true;
  }

  // Check if they mentioned their word
  const word = game.spyIndex === game.players.indexOf(sender) ? game.spyWord : game.commonWord;
  if (description.includes(word)) {
    messageQueue.enqueue(roomId, `⚠️ 不能直接说出你的词！请重新描述。`);
    return true;
  }

  game.descriptions[sender] = description;
  game.currentDescriber++;

  if (game.currentDescriber >= game.players.length) {
    // All described — start voting
    game.phase = 'voting';
    game.votes = {};
    const descText = game.descriptionOrder.map((p, i) => {
      const name = p;
      return `${i + 1}. ${name}: ${game.descriptions[p] || '（未描述）'}`;
    }).join('\n');

    messageQueue.enqueue(roomId, `📋 第${game.round}轮描述完毕！
━━━━━━━━━━
${descText}
━━━━━━━━━━
🗳 现在开始投票！请回复"投票 @玩家名"选择你要淘汰的人。
（回复"弃权"跳过投票）`);
  } else {
    const next = game.descriptionOrder[game.currentDescriber];
    messageQueue.enqueue(roomId, `👇 ${game.descriptionOrder[game.currentDescriber - 1]} 描述完毕\n🎤 轮到 @${next} 描述：`);
  }
  return true;
}

/**
 * Player votes
 */
export function handleUndercoverVote(roomId, sender, target) {
  const game = getGame(roomId);
  if (!game || game.phase !== 'voting') return false;

  if (!game.players.includes(sender)) return false;
  if (game.votes[sender]) {
    messageQueue.enqueue(roomId, '⚠️ 你已经投过票了！');
    return true;
  }

  if (target === '弃权') {
    game.votes[sender] = null;
    messageQueue.enqueue(roomId, `🗳 ${sender} 弃权`);
  } else {
    // Find target player
    const targetPlayer = game.players.find(p => {
      const name = p;
      return target.includes(name);
    });
    if (targetPlayer) {
      game.votes[sender] = targetPlayer;
      messageQueue.enqueue(roomId, `🗳 ${sender} 投票给了 ${targetPlayer}`);
    } else {
      messageQueue.enqueue(roomId, '⚠️ 请指定正确的玩家名，如"投票 @xxx"。你也可以回复"弃权"。');
      return true;
    }
  }

  // Check if all voted
  if (Object.keys(game.votes).length >= game.players.length) {
    // Count votes
    const voteCount = {};
    game.players.forEach(p => {
      const votedFor = game.votes[p];
      if (votedFor) {
        voteCount[votedFor] = (voteCount[votedFor] || 0) + 1;
      }
    });

    // Find most voted
    let maxVotes = 0;
    let eliminated = null;
    for (const [player, count] of Object.entries(voteCount)) {
      if (count > maxVotes) {
        maxVotes = count;
        eliminated = player;
      }
    }

    if (!eliminated || maxVotes === 0) {
      // No one eliminated
      messageQueue.enqueue(roomId, '😶 没有人被淘汰，进入下一轮！');
      nextRound(roomId);
      return true;
    }

    // Eliminate player
    const eliminatedIdx = game.players.indexOf(eliminated);
    const isSpy = eliminatedIdx === game.spyIndex;

    messageQueue.enqueue(roomId, `🚫 ${eliminated} 被淘汰出局！
${isSpy ? '🔍 他是卧底！平民胜利！🎉' : '❌ 他不是卧底……'}`);

    if (isSpy) {
      // Spy caught — civilians win
      const wordCommon = game.commonWord;
      const wordSpy = game.spyWord;
      messageQueue.enqueue(roomId, `🏁 游戏结束！卧底已被找出。
平民词: 「${wordCommon}」
卧底词: 「${wordSpy}」
👏 平民获胜！`);
      delete games[roomId];
      return true;
    }

    // Remove eliminated player
    game.players = game.players.filter(p => p !== eliminated);
    game.descriptionOrder = game.descriptionOrder.filter(p => p !== eliminated);
    if (game.spyIndex > eliminatedIdx) game.spyIndex--;
    else if (game.spyIndex === eliminatedIdx) {
      // Spy was eliminated? should not happen since isSpy was false
    }

    // Check if spy survives to last 2
    if (game.players.length <= 2) {
      messageQueue.enqueue(roomId, `🏁 游戏结束！只剩2人，卧底获胜！🎭
平民词: 「${game.commonWord}」
卧底词: 「${game.spyWord}」`);
      delete games[roomId];
      return true;
    }

    // Next round
    nextRound(roomId);
  }
  return true;
}

function nextRound(roomId) {
  const game = getGame(roomId);
  if (!game) return;

  game.round++;
  game.phase = 'describing';
  game.currentDescriber = 0;
  game.descriptions = {};
  game.votes = {};

  messageQueue.enqueue(roomId, `━━━ 第${game.round}轮开始 ━━━
🎤 ${game.descriptionOrder[0]} 先来描述！`);
}

/**
 * End game
 */
export function handleUndercoverEnd(roomId) {
  if (!games[roomId]) {
    messageQueue.enqueue(roomId, '⚠️ 当前没有进行中的卧底游戏。');
    return;
  }
  const game = games[roomId];
  messageQueue.enqueue(roomId, `🛑 游戏已结束。
平民词: 「${game.commonWord}」
卧底词: 「${game.spyWord}」`);
  delete games[roomId];
}
