import { LostFoundItem } from '../models/LostFound.js';
import { logger } from '@iuh-exchange/common';

/**
 * Vietnamese stop words to ignore during matching
 */
const STOP_WORDS = new Set([
  'và', 'của', 'là', 'có', 'được', 'cho', 'với', 'này', 'đó', 'từ',
  'trong', 'trên', 'dưới', 'cũng', 'như', 'hay', 'hoặc', 'nhưng',
  'một', 'cái', 'chiếc', 'bộ', 'đôi', 'cặp',
  'tôi', 'bạn', 'anh', 'chị', 'em', 'họ',
  'ở', 'tại', 'về', 'theo', 'sau', 'trước',
  'va', 'cua', 'la', 'co', 'duoc', 'cho', 'voi', 'nay', 'do', 'tu',
  'trong', 'tren', 'duoi', 'cung', 'nhu', 'hay', 'hoac', 'nhung',
  'mot', 'cai', 'chiec', 'bo', 'doi', 'cap',
  'toi', 'ban', 'anh', 'chi', 'em', 'ho',
  'o', 'tai', 've', 'theo', 'sau', 'truoc',
  'mat', 'nhat', 'tim', 'thay', 'vat', 'mon', 'bai', 'dang',
  'khu', 'vuc', 'gan', 'quanh', 'loanh', 'nha', 'toa', 'ham', 'xe',
]);

/**
 * Normalize Vietnamese text: lowercase, remove diacritics for matching, strip special chars.
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract meaningful keywords from text.
 */
function extractKeywords(text) {
  const normalized = normalizeText(text);
  return normalized
    .split(' ')
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

/**
 * Calculate Jaccard similarity between two keyword sets.
 */
function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

/**
 * Calculate overlap ratio: how many keywords from source appear in target.
 */
function overlapRatio(sourceKeywords, targetKeywords) {
  if (sourceKeywords.length === 0) return 0;
  const targetSet = new Set(targetKeywords);
  const matches = sourceKeywords.filter((w) => targetSet.has(w));
  return matches.length / sourceKeywords.length;
}

function keywordIntersection(sourceKeywords, targetKeywords) {
  const targetSet = new Set(targetKeywords);
  return sourceKeywords.filter((w) => targetSet.has(w));
}

function itemKeywords(item) {
  const text = [
    item.title,
    item.description,
    item.detectedType,
    ...(item.tags || []),
  ].filter(Boolean).join(' ');
  return extractKeywords(text);
}

function categoriesCompatible(source, candidate) {
  if (!source.category || !candidate.category) return true;
  if (source.category === 'OTHER' || candidate.category === 'OTHER') return true;
  return source.category === candidate.category;
}

function detectedTypesCompatible(source, candidate) {
  const sourceType = normalizeText(source.detectedType || '');
  const candidateType = normalizeText(candidate.detectedType || '');
  if (!sourceType || !candidateType || sourceType === 'unknown' || candidateType === 'unknown') return true;
  return sourceType === candidateType || sourceType.includes(candidateType) || candidateType.includes(sourceType);
}

/**
 * Normalize location for comparison (simplified).
 */
function normalizeLocation(loc) {
  if (!loc) return '';
  return normalizeText(loc);
}

/**
 * Calculate match score between a source item and a candidate item.
 * Returns a score between 0 and 1.
 *
 * Exported để controller có thể import sử dụng cho preview matches.
 * Không duplicate lại logic này ở chỗ khác (BUG FIX #9).
 */
export function calculateMatchScore(source, candidate) {
  if (!categoriesCompatible(source, candidate) || !detectedTypesCompatible(source, candidate)) {
    return 0;
  }

  const sourceAllKeywords = itemKeywords(source);
  const candidateAllKeywords = itemKeywords(candidate);
  const sharedKeywords = keywordIntersection(sourceAllKeywords, candidateAllKeywords);
  const sameSpecificCategory = source.category
    && candidate.category
    && source.category === candidate.category
    && source.category !== 'OTHER';

  if (sharedKeywords.length === 0) return 0;
  if (!sameSpecificCategory && sharedKeywords.length < 2) return 0;

  let score = 0;
  let weights = 0;

  // 1. Title similarity (weight: 35)
  const sourceTitleKeywords = extractKeywords(source.title);
  const candidateTitleKeywords = extractKeywords(candidate.title);
  const titleSim = jaccardSimilarity(
    new Set(sourceTitleKeywords),
    new Set(candidateTitleKeywords),
  );
  score += titleSim * 35;
  weights += 35;

  // 2. Description similarity (weight: 25)
  const sourceDescKeywords = extractKeywords(source.description || '');
  const candidateDescKeywords = extractKeywords(candidate.description || '');
  const descSim = jaccardSimilarity(
    new Set(sourceDescKeywords),
    new Set(candidateDescKeywords),
  );
  score += descSim * 25;
  weights += 25;

  // 3. Category match (weight: 20)
  if (source.category && candidate.category) {
    if (source.category === candidate.category) {
      score += 20;
    }
    weights += 20;
  }

  // 4. Tags overlap (weight: 15)
  if (source.tags?.length && candidate.tags?.length) {
    const sourceTags = new Set(source.tags.map(normalizeText));
    const candidateTags = new Set(candidate.tags.map(normalizeText));
    const tagSim = jaccardSimilarity(sourceTags, candidateTags);
    score += tagSim * 15;
    weights += 15;
  }

  // 5. Location similarity (weight: 5)
  const sourceLoc = normalizeLocation(source.location);
  const candidateLoc = normalizeLocation(candidate.location);
  if (sourceLoc && candidateLoc) {
    // Check if one contains the other or has keyword overlap
    const locSourceKw = new Set(sourceLoc.split(' '));
    const locCandidateKw = new Set(candidateLoc.split(' '));
    const locSim = jaccardSimilarity(locSourceKw, locCandidateKw);
    score += locSim * 5;
    weights += 5;
  }

  return weights > 0 ? score / weights : 0;
}

/**
 * Find matching items for a given LOST or FOUND item.
 *
 * Logic:
 * - If source is LOST → search for FOUND items
 * - If source is FOUND → search for LOST items
 *
 * @param {string} itemId - The source item ID
 * @param {object} options - { limit, minScore }
 * @returns {Array<{ item, score }>} Sorted by score descending
 */
export async function findMatches(itemId, options = {}) {
  const { limit = 10, minScore = 0.55 } = options;

  const source = await LostFoundItem.findById(itemId);
  if (!source) {
    throw new Error(`Item not found: ${itemId}`);
  }

  // Match opposite type, only OPEN items
  const targetType = source.type === 'LOST' ? 'FOUND' : 'LOST';
  const filter = {
    type: targetType,
    status: 'OPEN',
    _id: { $ne: source._id },
  };

  // Pre-filter by category if available (optimization)
  if (source.category && source.category !== 'OTHER') {
    filter.$or = [
      { category: source.category },
      { category: 'OTHER' },
    ];
  }

  const candidates = await LostFoundItem.find(filter)
    .sort({ createdAt: -1 })
    .limit(200); // Cap candidates for performance

  // Score each candidate
  const scored = [];
  for (const candidate of candidates) {
    const score = calculateMatchScore(source, candidate);
    if (score >= minScore) {
      scored.push({
        item: candidate,
        score: Math.round(score * 1000) / 1000, // Round to 3 decimals
      });
    }
  }

  // Sort by score descending, take top N
  scored.sort((a, b) => b.score - a.score);
  const topMatches = scored.slice(0, limit);

  logger.info(
    `Found ${topMatches.length} matches for item ${itemId} (${source.type}), ` +
    `from ${candidates.length} candidates`,
  );

  return topMatches;
}

/**
 * Auto-match when creating a new item.
 * Returns potential matches immediately so the user can be notified.
 */
export async function autoMatchOnCreate(item) {
  try {
    const matches = await findMatches(item._id.toString(), { limit: 5, minScore: 0.6 });
    return matches;
  } catch (err) {
    logger.warn(`Auto-match failed for item ${item._id}: ${err.message}`);
    return [];
  }
}
