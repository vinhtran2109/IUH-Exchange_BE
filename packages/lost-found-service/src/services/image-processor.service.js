/**
 * Image Processor Service
 *
 * Phân tích ảnh tải lên cho các đồ vật thất lạc:
 * - Object detection / phân loại đồ vật
 * - OCR: trích xuất chữ viết (MSSV, tên trên thẻ)
 * - Auto-categorization dựa trên nhãn phát hiện được
 *
 * Architecture: Provider Adapter Pattern — có thể hoán đổi giữa
 * Tesseract.js (cục bộ), Google Vision, AWS Rekognition mà không
 * thay đổi code gọi hàm.
 *
 * Triggered async sau khi tạo item (non-blocking cho user latency).
 */

import { logger, cache, withRetry } from '@iuh-exchange/common';
import { LostFoundItem } from '../models/LostFound.js';
import { publishLostFoundAnalyzed, publishLostFoundMatch } from './kafka.service.js';
import { findMatches } from './matching.service.js';

// ── Cấu hình ──

/**
 * Provider AI đang dùng. Đổi biến môi trường IMAGE_ANALYSIS_PROVIDER để chuyển:
 *   'tesseract'       — OCR cục bộ bằng Tesseract.js (mặc định, không cần API key)
 *   'google-vision'   — Google Cloud Vision API
 *   'aws-rekognition' — AWS Rekognition
 *   'mock'            — Giả lập cho development/testing
 */
const PROVIDER = process.env.IMAGE_ANALYSIS_PROVIDER || 'tesseract';
const MATCH_THRESHOLD = parseFloat(process.env.MATCH_THRESHOLD) || 0.3;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000; // 2s → 4s → 6s (Exponential Backoff)

// ── Provider Adapters ──

/**
 * Mock provider cho development/testing.
 * Trả về kết quả xác định dựa trên URL pattern.
 */
async function mockAnalyze(imageUrls) {
  await new Promise((r) => setTimeout(r, 500));

  const results = [];
  for (const url of imageUrls) {
    const urlLower = url.toLowerCase();
    let detectedType = 'unknown';
    let studentId = '';
    let text = '';
    let confidence = 0.5;

    if (urlLower.includes('wallet') || urlLower.includes('vi')) {
      detectedType = 'wallet'; confidence = 0.85;
    } else if (urlLower.includes('phone') || urlLower.includes('dien-thoai')) {
      detectedType = 'phone'; confidence = 0.9;
    } else if (urlLower.includes('key') || urlLower.includes('chinh-khoa')) {
      detectedType = 'keys'; confidence = 0.8;
    } else if (urlLower.includes('card') || urlLower.includes('the')) {
      detectedType = 'card'; confidence = 0.75;
      studentId = '2100001234';
      text = 'DH_CNTT MSSV: 2100001234';
    }

    results.push({ detectedType, studentId, text, confidence });
  }

  return results;
}

/**
 * Tesseract.js (OCR cục bộ) — AI thực tế, không cần tài khoản đám mây.
 *
 * BUG FIX #3 — Tránh Memory Leak:
 *   Dùng createWorker() + finally { worker.terminate() } thủ công.
 *   Không dùng Tesseract.recognize() vì API đó tạo/hủy worker ẩn
 *   không kiểm soát được, tích lũy sau nhiều lần gọi gây OOM.
 *
 * BUG FIX #4 — Tránh lỗi URL S3 hết hạn trong container:
 *   Fetch ảnh về Buffer trong memory trước khi đưa vào Tesseract.
 *   Tránh phụ thuộc vào mạng của worker process bên trong Docker.
 */
async function tesseractAnalyze(imageUrls) {
  // Import động để không bắt buộc install nếu dùng provider khác
  const { default: Tesseract } = await import('tesseract.js');

  const results = [];

  for (const url of imageUrls) {
    // BUG FIX #4: Download ảnh về Buffer — không truyền URL trực tiếp cho Tesseract
    logger.info(`[AI OCR] Đang tải ảnh từ: ${url.substring(0, 80)}...`);
    const fetchResponse = await fetch(url);
    if (!fetchResponse.ok) {
      throw new Error(
        `Không thể tải ảnh để phân tích (HTTP ${fetchResponse.status}): ${url}`
      );
    }
    const imageBuffer = Buffer.from(await fetchResponse.arrayBuffer());

    // BUG FIX #3: Tạo worker thủ công, luôn terminate trong finally
    const worker = await Tesseract.createWorker('eng+vie');
    try {
      logger.info('[AI OCR] Đang quét OCR bằng Tesseract.js (eng+vie)...');
      const { data: { text, confidence: rawConfidence } } = await worker.recognize(imageBuffer);

      logger.debug(`[AI OCR] Kết quả text: "${text.trim().substring(0, 120)}"`);
      logger.debug(`[AI OCR] Tesseract confidence: ${rawConfidence?.toFixed(1)}%`);

      // Phát hiện loại thẻ/đồ vật từ nội dung text
      let detectedType = 'document';
      let confidence = Math.min(rawConfidence / 100, 0.99) || 0.55;
      const lower = text.toLowerCase();

      if (lower.includes('sinh viên') || lower.includes('student') || lower.includes('iuh') ||
          lower.includes('đại học') || lower.includes('university')) {
        detectedType = 'student_card';
        confidence = Math.max(confidence, 0.85);
      } else if (lower.includes('căn cước') || lower.includes('citizen') ||
                 lower.includes('chứng minh nhân dân')) {
        detectedType = 'id_card';
        confidence = Math.max(confidence, 0.8);
      } else if (lower.includes('giấy phép lái xe') || lower.includes('driving license') ||
                 lower.includes('driver')) {
        detectedType = 'driver_license';
        confidence = Math.max(confidence, 0.75);
      } else if (lower.includes('thẻ') || lower.includes('card')) {
        detectedType = 'card';
        confidence = Math.max(confidence, 0.6);
      }

      results.push({
        detectedType,
        studentId: extractStudentId(text),
        text,
        confidence,
      });
    } finally {
      // BUG FIX #3: Luôn terminate để giải phóng bộ nhớ
      await worker.terminate();
      logger.debug('[AI OCR] Tesseract worker đã được terminate');
    }
  }

  return results;
}

/**
 * Google Cloud Vision API adapter.
 * Requires: GOOGLE_APPLICATION_CREDENTIALS env var
 */
async function googleVisionAnalyze(imageUrls) {
  // TODO: Implement với @google-cloud/vision
  throw new Error('Google Vision provider chưa cài đặt. Set IMAGE_ANALYSIS_PROVIDER=tesseract');
}

/**
 * AWS Rekognition adapter.
 * Requires: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION env vars
 */
async function awsRekognitionAnalyze(imageUrls) {
  // TODO: Implement với @aws-sdk/client-rekognition
  throw new Error('AWS Rekognition provider chưa cài đặt. Set IMAGE_ANALYSIS_PROVIDER=tesseract');
}

// ── Provider Registry ──

const providers = {
  mock: mockAnalyze,
  tesseract: tesseractAnalyze,
  'google-vision': googleVisionAnalyze,
  'aws-rekognition': awsRekognitionAnalyze,
};

// ── Trích xuất MSSV ──

/**
 * Trích xuất mã số sinh viên (MSSV) từ text OCR.
 * MSSV của IUH thường là số 10 chữ số.
 */
function extractStudentId(text) {
  if (!text) return '';

  // Pattern 1: Nhãn MSSV rõ ràng
  const mssvMatch = text.match(/(?:MSSV|mã\s*số\s*sinh\s*viên|student\s*id)[:\s]*(\d{8,12})/i);
  if (mssvMatch) return mssvMatch[1];

  // Pattern 2: Số 10 chữ số standalone (định dạng IUH phổ biến)
  const standaloneMatch = text.match(/\b(\d{10})\b/);
  if (standaloneMatch) return standaloneMatch[1];

  // Pattern 3: Bất kỳ số 8-12 chữ số nào
  const anyMatch = text.match(/\b(\d{8,12})\b/);
  if (anyMatch) return anyMatch[1];

  return '';
}

// ── Ánh xạ Category ──

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
  driver_license: 'DOCUMENTS',
  notebook: 'DOCUMENTS',
  document: 'DOCUMENTS',
  umbrella: 'OTHER',
  bottle: 'OTHER',
  clothing: 'CLOTHING',
  shirt: 'CLOTHING',
  jacket: 'CLOTHING',
  hat: 'CLOTHING',
  scarf: 'CLOTHING',
};

/**
 * Tự động phân loại category từ loại đồ vật phát hiện được.
 */
function inferCategory(detectedType) {
  const normalized = detectedType.toLowerCase().replace(/[\s-]/g, '_');
  return DETECTED_TYPE_TO_CATEGORY[normalized] || 'OTHER';
}

// ── Hàm phân tích chính ──

/**
 * Phân tích ảnh của một lost-found item.
 *
 * BUG FIX #3 & #4 (integrated): withRetry CHỈ bọc lớp provider call,
 * không bọc toàn bộ hàm để tránh retry lại các thao tác DB đã ghi thành công.
 *
 * @param {string} itemId - ID của LostFoundItem
 * @param {object} options - { force: boolean }
 */
export async function analyzeItem(itemId, options = {}) {
  const { force = false } = options;

  const item = await LostFoundItem.findById(itemId);
  if (!item) {
    throw new Error(`Item không tồn tại: ${itemId}`);
  }

  // Bỏ qua nếu đã phân tích (trừ khi force)
  if (!force && item.analysisStatus === 'COMPLETED') {
    logger.info(`Item ${itemId} đã được phân tích trước đó, bỏ qua`);
    return { status: 'skipped', item };
  }

  // Bỏ qua nếu không có ảnh
  if (!item.images?.length) {
    item.analysisStatus = 'SKIPPED';
    await item.save();
    logger.info(`Item ${itemId} không có ảnh, bỏ qua phân tích`);
    return { status: 'skipped', reason: 'no_images', item };
  }

  const provider = providers[PROVIDER];
  if (!provider) {
    throw new Error(`Provider AI không hợp lệ: ${PROVIDER}`);
  }

  // Đánh dấu đang xử lý
  item.analysisStatus = 'PROCESSING';
  await item.save();

  try {
    logger.info(`Bắt đầu phân tích item ${itemId} với provider=${PROVIDER}`);

    // BUG FIX #3 (phần 2): withRetry CHỈ bọc provider call AI.
    // Không bọc toàn bộ analyzeItem vì các bước DB đã ghi không nên retry lại.
    const results = await withRetry(
      () => provider(item.images),
      MAX_RETRIES,
      RETRY_BASE_DELAY_MS
    );

    // Lấy kết quả tốt nhất (confidence cao nhất)
    const best = results.reduce(
      (a, b) => (a.confidence > b.confidence ? a : b),
      { detectedType: '', studentId: '', text: '', confidence: 0 }
    );

    // Cập nhật item với kết quả phân tích
    item.analysisStatus = 'COMPLETED';
    item.detectedType = best.detectedType;
    item.analysisConfidence = best.confidence;
    item.extracted = {
      // BUG FIX #8: KHÔNG gọi lại extractStudentId(best.text) ở đây.
      // tesseractAnalyze đã gọi extractStudentId(text) và lưu vào best.studentId.
      // Gọi 2 lần với cùng input sẽ cho cùng kết quả nhưng tốn CPU không cần thiết.
      studentId: best.studentId,
      text: best.text,
    };
    item.analysisMetadata = {
      provider: PROVIDER,
      analyzedAt: new Date().toISOString(),
      rawResults: results,
    };

    // Tự động gợi ý category nếu đang là 'OTHER'
    if (item.category === 'OTHER' && best.detectedType) {
      const suggestedCategory = inferCategory(best.detectedType);
      if (suggestedCategory !== 'OTHER') {
        item.category = suggestedCategory;
        logger.info(
          `Auto-categorized item ${itemId} → ${suggestedCategory} (detected: ${best.detectedType})`
        );
      }
    }

    // Tự động thêm tags từ detectedType
    if (best.detectedType && (!item.tags || item.tags.length === 0)) {
      item.tags = [best.detectedType.toLowerCase()];
    }

    await item.save();

    // BUG FIX #8: Evict cache detail để frontend nhận data mới nhất sau AI xong
    // (tránh stale cache trong 5 phút khi analysisStatus còn là PROCESSING)
    await cache.del(`lostfound:detail:${itemId}`);
    logger.debug(`[Cache] Evicted lostfound:detail:${itemId} sau khi AI phân tích xong`);

    // Publish sự kiện analyzed
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

    // Chạy matching sau khi phân tích (category & tags đã được cập nhật bởi AI)
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
      logger.warn(`Post-analysis matching thất bại cho item ${itemId}: ${matchErr.message}`);
    }

    logger.info(
      `Phân tích hoàn thành cho item ${itemId}: ` +
      `type=${best.detectedType}, confidence=${best.confidence.toFixed(3)}`
    );

    return {
      status: 'completed',
      detectedType: item.detectedType,
      studentId: item.extracted.studentId,
      confidence: item.analysisConfidence,
      category: item.category,
    };
  } catch (err) {
    // Lưu trạng thái thất bại
    item.analysisStatus = 'FAILED';
    item.analysisMetadata = {
      provider: PROVIDER,
      failedAt: new Date().toISOString(),
      error: err.message,
    };
    await item.save();

    logger.error(`Phân tích thất bại sau ${MAX_RETRIES} lần retry cho item ${itemId}: ${err.message}`);

    return { status: 'failed', error: err.message };
  }
}

/**
 * Xếp hàng phân tích bất đồng bộ (non-blocking).
 * Sử dụng fire-and-forget với error logging.
 * Production: nên dùng BullMQ hoặc Redis Queue.
 */
export function queueAnalysis(itemId, options = {}) {
  analyzeItem(itemId, options).catch((err) => {
    logger.error(`Queued analysis thất bại cho item ${itemId}: ${err.message}`);
  });
}

/**
 * BUG FIX #11: Cleanup các item bị stuck ở trạng thái PROCESSING quá lâu.
 *
 * Nếu service crash giữa chừng khi analysisStatus = 'PROCESSING',
 * item sẽ bị stuck vĩnh viễn và không bao giờ được retry.
 *
 * Nên gọi hàm này một lần khi service khởi động và mỗi 10 phút (cron job).
 *
 * @param {number} maxAgeMinutes - Sau bao nhiêu phút thì coi là stuck (default: 10)
 */
export async function cleanupStuckProcessing(maxAgeMinutes = 10) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

  try {
    const result = await (await import('../models/LostFound.js')).LostFoundItem.updateMany(
      {
        analysisStatus: 'PROCESSING',
        updatedAt: { $lt: cutoff }, // stuck > maxAgeMinutes phút
      },
      {
        $set: {
          analysisStatus: 'PENDING', // reset về PENDING để có thể retry
          'analysisMetadata.stuckResetAt': new Date().toISOString(),
        },
      }
    );

    if (result.modifiedCount > 0) {
      logger.warn(
        `[Cleanup] Reset ${result.modifiedCount} item bị stuck PROCESSING > ${maxAgeMinutes}ph về PENDING`
      );
    }

    return result.modifiedCount;
  } catch (err) {
    logger.error(`[Cleanup] cleanupStuckProcessing thất bại: ${err.message}`);
    return 0;
  }
}
