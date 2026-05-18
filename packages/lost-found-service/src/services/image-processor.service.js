/**
 * Image Processor Service
 *
 * Analyzes uploaded images for lost-found items:
 * - Object detection (classify what the item is)
 * - OCR (extract text like student ID / MSSV)
 * - Auto-categorization
 *
 * Architecture: Provider adapter pattern — swap between cloud Vision API
 * (Google Vision, AWS Rekognition) or local Tesseract without changing callers.
 *
 * Triggered async after item creation (non-blocking for user latency).
 */

import { logger } from '@iuh-exchange/common';
import { LostFoundItem } from '../models/LostFound.js';
import { publishLostFoundAnalyzed, publishLostFoundMatch } from './kafka.service.js';
import { findMatches } from './matching.service.js';

// ── Configuration ──

const PROVIDER = process.env.IMAGE_ANALYSIS_PROVIDER || 'mock'; // 'google-vision' | 'aws-rekognition' | 'tesseract' | 'mock'
const MATCH_THRESHOLD = parseFloat(process.env.MATCH_THRESHOLD) || 0.3;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// ── Provider Adapters ──

/**
 * Mock provider for development/testing.
 * Returns deterministic results based on image URL patterns.
 */
async function mockAnalyze(imageUrls) {
  // Simulate processing delay
  await new Promise((r) => setTimeout(r, 500));

  const results = [];
  for (const url of imageUrls) {
    const urlLower = url.toLowerCase();
    let detectedType = 'unknown';
    let studentId = '';
    let text = '';
    let confidence = 0.5;

    // Simple pattern matching for demo
    if (urlLower.includes('wallet') || urlLower.includes('vi')) {
      detectedType = 'wallet';
      confidence = 0.85;
    } else if (urlLower.includes('phone') || urlLower.includes('dien-thoai')) {
      detectedType = 'phone';
      confidence = 0.9;
    } else if (urlLower.includes('key') || urlLower.includes('chinh-khoa')) {
      detectedType = 'keys';
      confidence = 0.8;
    } else if (urlLower.includes('card') || urlLower.includes('the')) {
      detectedType = 'card';
      confidence = 0.75;
      // Simulate MSSV extraction
      studentId = '2100001234';
      text = 'DH_CNTT MSSV: 2100001234';
    }

    results.push({ detectedType, studentId, text, confidence });
  }

  return results;
}

/**
 * Google Cloud Vision API adapter.
 * Requires: GOOGLE_APPLICATION_CREDENTIALS env var
 */
async function googleVisionAnalyze(imageUrls) {
  // TODO: Implement with @google-cloud/vision
  // const vision = require('@google-cloud/vision');
  // const client = new vision.ImageAnnotatorClient();
  //
  // for (const url of imageUrls) {
  //   const [result] = await client.labelDetection(url);
  //   const labels = result.labelAnnotations;
  //   const [textResult] = await client.textDetection(url);
  //   const texts = textResult.textAnnotations;
  //   // Extract MSSV from text using regex
  // }
  throw new Error('Google Vision provider not implemented. Set IMAGE_ANALYSIS_PROVIDER=mock for development.');
}

/**
 * AWS Rekognition adapter.
 * Requires: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION env vars
 */
async function awsRekognitionAnalyze(imageUrls) {
  // TODO: Implement with @aws-sdk/client-rekognition
  // const client = new RekognitionClient({ region: process.env.AWS_REGION });
  //
  // for (const url of imageUrls) {
  //   const params = { Image: { S3Object: { ... } } };
  //   const labels = await client.send(new DetectLabelsCommand(params));
  //   const text = await client.send(new DetectTextCommand(params));
  // }
  throw new Error('AWS Rekognition provider not implemented. Set IMAGE_ANALYSIS_PROVIDER=mock for development.');
}

/**
 * Tesseract.js (local OCR) adapter.
 * Good for MSSV extraction, weaker for object classification.
 */
async function tesseractAnalyze(imageUrls) {
  // TODO: Implement with tesseract.js
  // const Tesseract = require('tesseract.js');
  //
  // for (const url of imageUrls) {
  //   const { data: { text } } = await Tesseract.recognize(url, 'vie+eng');
  //   const studentId = extractMSSV(text);
  // }
  throw new Error('Tesseract provider not implemented. Set IMAGE_ANALYSIS_PROVIDER=mock for development.');
}

// ── Provider Registry ──

const providers = {
  mock: mockAnalyze,
  'google-vision': googleVisionAnalyze,
  'aws-rekognition': awsRekognitionAnalyze,
  tesseract: tesseractAnalyze,
};

// ── MSSV Extraction ──

/**
 * Extract student ID (MSSV) from OCR text.
 * IUH student IDs are typically 10-digit numbers.
 */
function extractStudentId(text) {
  if (!text) return '';

  // Pattern 1: Explicit MSSV label
  const mssvMatch = text.match(/(?:MSSV|mã\s*số\s*sinh\s*viên|student\s*id)[:\s]*(\d{8,12})/i);
  if (mssvMatch) return mssvMatch[1];

  // Pattern 2: Standalone 10-digit number (common IUH format)
  const standaloneMatch = text.match(/\b(\d{10})\b/);
  if (standaloneMatch) return standaloneMatch[1];

  // Pattern 3: Any 8-12 digit number
  const anyMatch = text.match(/\b(\d{8,12})\b/);
  if (anyMatch) return anyMatch[1];

  return '';
}

// ── Category Mapping ──

const DETECTED_TYPE_TO_CATEGORY = {
  wallet: 'ACCESSORIES',
  phone: 'ELECTRONICS',
  laptop: 'ELECTRONICS',
  tablet: 'ELECTRONICS',
  headphones: 'ELECTRONICS',
  earbuds: 'ELECTRONICS',
  charger: 'ELECTRONICS',
  cable: 'ELECTRONICS',
  keys: 'KEYS',
  keychain: 'KEYS',
  bag: 'BAGS',
  backpack: 'BAGS',
  purse: 'BAGS',
  card: 'DOCUMENTS',
  id_card: 'DOCUMENTS',
  student_card: 'DOCUMENTS',
  notebook: 'DOCUMENTS',
  umbrella: 'OTHER',
  bottle: 'OTHER',
  clothing: 'CLOTHING',
  shirt: 'CLOTHING',
  jacket: 'CLOTHING',
  hat: 'CLOTHING',
  scarf: 'CLOTHING',
};

/**
 * Auto-categorize based on detected object type.
 */
function inferCategory(detectedType) {
  const normalized = detectedType.toLowerCase().replace(/[\s-]/g, '_');
  return DETECTED_TYPE_TO_CATEGORY[normalized] || 'OTHER';
}

// ── Main Analysis Function ──

/**
 * Analyze a single lost-found item's images.
 *
 * @param {string} itemId - The LostFoundItem ID
 * @param {object} options - { force: boolean } — re-analyze even if already done
 * @returns {object} Analysis result
 */
export async function analyzeItem(itemId, options = {}) {
  const { force = false } = options;

  const item = await LostFoundItem.findById(itemId);
  if (!item) {
    throw new Error(`Item not found: ${itemId}`);
  }

  // Skip if already analyzed (unless force)
  if (!force && item.analysisStatus === 'COMPLETED') {
    logger.info(`Item ${itemId} already analyzed, skipping`);
    return { status: 'skipped', item };
  }

  // Skip if no images
  if (!item.images?.length) {
    item.analysisStatus = 'SKIPPED';
    await item.save();
    logger.info(`Item ${itemId} has no images, skipping analysis`);
    return { status: 'skipped', reason: 'no_images', item };
  }

  // Mark as processing
  item.analysisStatus = 'PROCESSING';
  await item.save();

  const provider = providers[PROVIDER];
  if (!provider) {
    throw new Error(`Unknown image analysis provider: ${PROVIDER}`);
  }

  let retries = 0;
  let lastError = null;

  while (retries < MAX_RETRIES) {
    try {
      logger.info(`Analyzing item ${itemId} with provider=${PROVIDER}, attempt=${retries + 1}`);

      const results = await provider(item.images);

      // Take the best result (highest confidence)
      const best = results.reduce((a, b) => (a.confidence > b.confidence ? a : b), {
        detectedType: '',
        studentId: '',
        text: '',
        confidence: 0,
      });

      // Update item with analysis results
      item.analysisStatus = 'COMPLETED';
      item.detectedType = best.detectedType;
      item.analysisConfidence = best.confidence;
      item.extracted = {
        studentId: extractStudentId(best.text) || best.studentId,
        text: best.text,
      };
      item.analysisMetadata = {
        provider: PROVIDER,
        analyzedAt: new Date().toISOString(),
        rawResults: results,
      };

      // Auto-suggest category if currently 'OTHER'
      if (item.category === 'OTHER' && best.detectedType) {
        const suggestedCategory = inferCategory(best.detectedType);
        if (suggestedCategory !== 'OTHER') {
          item.category = suggestedCategory;
          logger.info(`Auto-categorized item ${itemId} as ${suggestedCategory} (detected: ${best.detectedType})`);
        }
      }

      // Auto-suggest tags from detected type
      if (best.detectedType && (!item.tags || item.tags.length === 0)) {
        item.tags = [best.detectedType.toLowerCase()];
      }

      await item.save();

      // Publish analyzed event
      await publishLostFoundAnalyzed({
        itemId: item._id.toString(),
        userId: item.userId.toString(),
        type: item.type,
        title: item.title,
        detectedType: item.detectedType,
        studentId: item.extracted.studentId,
        confidence: item.analysisConfidence,
        category: item.category,
      });

      // Run post-analysis matching
      try {
        const matches = await findMatches(itemId, { limit: 5, minScore: MATCH_THRESHOLD });
        if (matches.length > 0) {
          await publishLostFoundMatch({
            itemId: item._id.toString(),
            userId: item.userId.toString(),
            type: item.type,
            title: item.title,
            matches: matches.map((m) => ({
              itemId: m.item._id.toString(),
              title: m.item.title,
              score: m.score,
              ownerId: m.item.userId.toString(),
            })),
          });
        }
      } catch (matchErr) {
        logger.warn(`Post-analysis matching failed for item ${itemId}: ${matchErr.message}`);
      }

      logger.info(`Analysis completed for item ${itemId}: type=${best.detectedType}, confidence=${best.confidence}`);

      return {
        status: 'completed',
        detectedType: item.detectedType,
        studentId: item.extracted.studentId,
        confidence: item.analysisConfidence,
        category: item.category,
      };
    } catch (err) {
      lastError = err;
      retries++;
      logger.warn(`Analysis attempt ${retries} failed for item ${itemId}: ${err.message}`);

      if (retries < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * retries)); // Exponential backoff
      }
    }
  }

  // All retries failed
  item.analysisStatus = 'FAILED';
  item.analysisMetadata = {
    provider: PROVIDER,
    failedAt: new Date().toISOString(),
    error: lastError?.message,
    retries,
  };
  await item.save();

  logger.error(`Analysis failed for item ${itemId} after ${retries} retries: ${lastError?.message}`);

  return {
    status: 'failed',
    error: lastError?.message,
  };
}

/**
 * Queue an item for async analysis (non-blocking).
 * In production, this would push to a job queue (Bull, BullMQ, etc.)
 * For now, fire-and-forget with error logging.
 */
export function queueAnalysis(itemId) {
  analyzeItem(itemId).catch((err) => {
    logger.error(`Queued analysis failed for item ${itemId}: ${err.message}`);
  });
}
