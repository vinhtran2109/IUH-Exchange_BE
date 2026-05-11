const BLACKLIST = [
  'đâm tặc', 'lừa đảo', 'chó rẻ', 'chửi bới',
  'shit', 'fuck', 'bitch', 'scam', 'ltd',
  'mẹ mày', 'đmm', 'clm', 'vcl', 'vl',
  'dm', 'dcm', 'cc', 'cặc', 'lồn',
  'đéo', 'đụ', 'đĩ', 'óc chó', 'não chó',
];

/**
 * Normalize Vietnamese text for profanity detection.
 * Strips diacritics and converts to lowercase.
 */
function normalizeVietnamese(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase();
}

/**
 * Check if text contains profanity.
 * Normalizes Vietnamese text before matching to catch obfuscation attempts.
 * @param {string|null} text
 * @returns {boolean}
 */
export function containsProfanity(text) {
  if (!text || !text.trim()) return false;
  
  const normalized = normalizeVietnamese(text);
  
  return BLACKLIST.some((word) => {
    const normalizedWord = normalizeVietnamese(word);
    // Use regex with word boundaries to avoid false positives like "admin" containing "dm"
    const regex = new RegExp(`\\b${normalizedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(normalized);
  });
}
