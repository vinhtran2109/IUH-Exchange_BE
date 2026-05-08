const BLACKLIST = [
  'đâm tặc', 'lừa đảo', 'chó rẻ', 'chửi bới',
  'shit', 'fuck', 'bitch', 'scam', 'ltd',
  'mẹ mày', 'đmm', 'clm', 'vcl', 'vl',
];

/**
 * Check if text contains profanity.
 * Uses lowercase substring matching against the blacklist.
 * @param {string|null} text
 * @returns {boolean}
 */
export function containsProfanity(text) {
  if (!text || !text.trim()) return false;
  const lower = text.toLowerCase();
  return BLACKLIST.some((word) => lower.includes(word));
}
