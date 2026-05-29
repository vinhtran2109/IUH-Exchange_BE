import { BadRequestException, logger } from '@iuh-exchange/common';
import { containsProfanity } from './profanity-filter.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_OUTPUT_TOKENS = 300;

const SYSTEM_INSTRUCTION = `
You are a strict marketplace content moderator for IUH Exchange, a campus app for students.
Review only the product listing text.
Reject listings that include scams, fraud, illegal items, dangerous goods, hate/harassment, sexual content, profanity, spam, requests for OTP/passwords, or suspicious off-platform payment pressure.
Allow ordinary second-hand student items, books, electronics, clothes, furniture, food, and trade/giveaway listings.
Return only valid JSON with this shape:
{"decision":"ALLOW"|"REJECT","category":"OK"|"PROFANITY"|"SCAM"|"ILLEGAL"|"DANGEROUS"|"SEXUAL"|"HARASSMENT"|"SPAM"|"OTHER","reason":"short Vietnamese reason","confidence":0.0}
`.trim();

function getGeminiConfig() {
  return {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.PRODUCT_MODERATION_MODEL || process.env.GEMINI_MODEL || DEFAULT_MODEL,
  };
}

function stripJsonFence(text) {
  const stripped = String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return stripped.slice(start, end + 1);
  }
  return stripped;
}

function extractText(payload) {
  return payload?.candidates
    ?.flatMap((candidate) => candidate?.content?.parts || [])
    ?.map((part) => part?.text || '')
    ?.join('')
    ?.trim();
}

function normalizeDecision(parsed) {
  const decision = parsed?.decision === 'REJECT' ? 'REJECT' : 'ALLOW';
  const category = String(parsed?.category || (decision === 'ALLOW' ? 'OK' : 'OTHER')).toUpperCase();
  const confidence = Number(parsed?.confidence);

  return {
    allowed: decision === 'ALLOW',
    status: decision === 'ALLOW' ? 'PASSED' : 'REJECTED',
    category,
    reason: String(parsed?.reason || '').slice(0, 500),
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
    provider: 'gemini',
    model: getGeminiConfig().model,
    checkedAt: new Date(),
  };
}

async function moderateWithGemini({ title, description, category, listingType, tradeWanted }) {
  const { apiKey, model } = getGeminiConfig();
  if (!apiKey) {
    return {
      allowed: true,
      status: 'SKIPPED',
      category: 'OK',
      reason: 'GEMINI_API_KEY is not configured',
      confidence: 0,
      provider: 'fallback',
      model: '',
      checkedAt: new Date(),
    };
  }

  const response = await fetch(`${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents: [
        {
          role: 'user',
          parts: [{
            text: JSON.stringify({
              title,
              description,
              category,
              listingType,
              tradeWanted,
            }),
          }],
        },
      ],
      generationConfig: {
        temperature: 0,
        topP: 0.8,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini API returned ${response.status}`);
  }

  const rawText = extractText(payload);
  if (!rawText) {
    throw new Error('Gemini returned an empty moderation response');
  }

  return normalizeDecision(JSON.parse(stripJsonFence(rawText)));
}

export async function moderateProductContent(productInput) {
  const text = [
    productInput.title,
    productInput.description,
    productInput.tradeWanted,
  ].filter(Boolean).join('\n');

  if (containsProfanity(text)) {
    return {
      allowed: false,
      status: 'REJECTED',
      category: 'PROFANITY',
      reason: 'Nội dung chứa từ ngữ không phù hợp với môi trường học đường.',
      confidence: 1,
      provider: 'blacklist',
      model: '',
      checkedAt: new Date(),
    };
  }

  const normalizedText = text.toLowerCase();
  const suspiciousPatterns = [
    /otp/,
    /mật\s*khẩu/,
    /password/,
    /chuyển\s*khoản\s*trước/,
    /ck\s*trước/,
    /cọc\s*trước/,
    /tài\s*khoản\s*ngân\s*hàng/,
  ];
  if (suspiciousPatterns.some((pattern) => pattern.test(normalizedText))) {
    return {
      allowed: false,
      status: 'REJECTED',
      category: 'SCAM',
      reason: 'Nội dung có dấu hiệu yêu cầu thông tin nhạy cảm hoặc thanh toán không an toàn.',
      confidence: 0.95,
      provider: 'local-rules',
      model: '',
      checkedAt: new Date(),
    };
  }

  try {
    return await moderateWithGemini(productInput);
  } catch (err) {
    logger.warn(`Product AI moderation failed, falling back to blacklist result: ${err.message}`);
    return {
      allowed: true,
      status: 'ERROR',
      category: 'OK',
      reason: 'AI moderation unavailable; blacklist fallback passed.',
      confidence: 0,
      provider: 'fallback',
      model: getGeminiConfig().model,
      checkedAt: new Date(),
    };
  }
}

export function assertProductAllowed(moderation) {
  if (!moderation.allowed) {
    throw new BadRequestException(
      moderation.reason || 'Nội dung sản phẩm không phù hợp với chính sách kiểm duyệt.',
    );
  }
}
