/**
 * Token compressor — optimizes input before sending to DeepSeek.
 * Follows the doc spec: name abbreviations, keyword replacement,
 * delete meaningless text, single-round input format.
 */

const NAME_MAP = {
  '管理员': 'A',
  '群主': 'O',
};

const KEYWORD_MAP = {
  '服务器': 'srv',
  '数据库': 'db',
  '上线': 'up',
  '下线': 'down',
  '修复': 'fix',
  '问题': 'issue',
  '更新': 'upd',
  '部署': 'deploy',
};

const MEANINGLESS_PATTERNS = [
  /^收到$/,
  /^好的$/,
  /^嗯+$/,
  /^哈+$/,
  /^\.\.\.+$/,
  /^好的收到$/,
];

function isMeaningless(text) {
  return MEANINGLESS_PATTERNS.some(p => p.test(text.trim()));
}

function compressText(text) {
  let result = text;
  for (const [key, val] of Object.entries(NAME_MAP)) {
    result = result.replace(new RegExp(key, 'g'), val);
  }
  for (const [key, val] of Object.entries(KEYWORD_MAP)) {
    result = result.replace(new RegExp(key, 'g'), val);
  }
  return result;
}

/**
 * Compress a single message and return { compressed, content, skipped }.
 */
export function compressMessage(msg) {
  if (isMeaningless(msg.content)) {
    return { ...msg, compressed: '', skipped: true };
  }
  const name = NAME_MAP[msg.sender] || msg.sender.slice(0, 1);
  const compressed = `${name}:${compressText(msg.content)}`;
  return { ...msg, compressed };
}

/**
 * Batch compress messages for summary.
 * Output format example:
 *   Z:srv down
 *   L:fix ok
 */
export function compressForSummary(messages) {
  return messages
    .map(msg => compressMessage(msg))
    .filter(m => !m.skipped)
    .map(m => m.compressed)
    .slice(-100); // max 100 lines per summary
}

/**
 * Compress for AI chat (Q&A format).
 */
export function compressForChat(sender, content) {
  const name = NAME_MAP[sender] || sender.slice(0, 1);
  return `Q:${name}:${compressText(content)}\nA:`;
}
