import { logger } from '@iuh-exchange/common';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const CATEGORY_ENUM = ['ELECTRONICS', 'ACCESSORIES', 'CLOTHING', 'DOCUMENTS', 'KEYS', 'BAGS', 'OTHER'];

const CATEGORY_KEYWORDS = [
  { category: 'ELECTRONICS', tags: ['phone'], patterns: [/điện\s*thoại/i, /iphone/i, /samsung/i, /laptop/i, /tai\s*nghe/i, /sạc/i, /usb/i] },
  { category: 'DOCUMENTS', tags: ['card'], patterns: [/thẻ/i, /mssv/i, /sinh\s*viên/i, /cccd/i, /giấy\s*tờ/i, /bằng\s*lái/i] },
  { category: 'KEYS', tags: ['keys'], patterns: [/chìa\s*khóa/i, /key/i, /smartkey/i] },
  { category: 'BAGS', tags: ['bag'], patterns: [/balo/i, /ba\s*lô/i, /túi/i, /cặp/i, /vali/i] },
  { category: 'ACCESSORIES', tags: ['accessory'], patterns: [/ví/i, /wallet/i, /kính/i, /đồng\s*hồ/i, /nhẫn/i] },
  { category: 'CLOTHING', tags: ['clothing'], patterns: [/áo/i, /quần/i, /mũ/i, /nón/i, /giày/i, /dép/i] },
];

function getGeminiConfig() {
  return {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.LOSTFOUND_AI_MODEL || process.env.GEMINI_MODEL || DEFAULT_MODEL,
  };
}

function inferType(title = '') {
  const text = title.toLowerCase();
  if (/nhặt|tìm\s*thấy|found|lượm/.test(text)) return 'FOUND';
  return 'LOST';
}

function inferCategoryAndTags(title = '') {
  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.patterns.some((pattern) => pattern.test(title))) {
      return { category: entry.category, tags: entry.tags };
    }
  }
  return { category: 'OTHER', tags: [] };
}

function cleanTags(tags) {
  return [...new Set((tags || [])
    .map((tag) => String(tag || '').trim().toLowerCase())
    .filter(Boolean))]
    .slice(0, 10);
}

function normalizeDraft(input, draft = {}) {
  const type = ['LOST', 'FOUND'].includes(draft.type)
    ? draft.type
    : ['LOST', 'FOUND'].includes(input.type)
      ? input.type
      : inferType(input.title);
  const inferred = inferCategoryAndTags(`${input.title} ${draft.description || ''}`);
  const category = CATEGORY_ENUM.includes(draft.category) ? draft.category : inferred.category;
  const tags = cleanTags([...(draft.tags || []), ...inferred.tags]);

  const fallbackPrefix = type === 'FOUND' ? 'Nhặt được' : 'Bị mất';
  const fallbackDescription = [
    `${fallbackPrefix}: ${input.title}.`,
    input.location ? `Khu vực: ${input.location}.` : '',
    input.images?.length ? 'Có hình ảnh đính kèm để đối chiếu.' : '',
    'Bạn nào có thông tin vui lòng liên hệ qua ứng dụng.',
  ].filter(Boolean).join(' ');

  return {
    type,
    title: String(draft.title || input.title).trim().slice(0, 200),
    description: String(draft.description || fallbackDescription).trim().slice(0, 2000),
    location: input.location,
    images: input.images || [],
    category,
    tags,
    verificationQuestion: String(
      draft.verificationQuestion || 'Bạn hãy mô tả đặc điểm nhận dạng của món đồ này?'
    ).trim().slice(0, 300),
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
  return start !== -1 && end !== -1 && end > start ? stripped.slice(start, end + 1) : stripped;
}

function extractText(payload) {
  return payload?.candidates
    ?.flatMap((candidate) => candidate?.content?.parts || [])
    ?.map((part) => part?.text || '')
    ?.join('')
    ?.trim();
}

async function generateWithGemini(input) {
  const { apiKey, model } = getGeminiConfig();
  if (!apiKey) return null;

  const response = await fetch(`${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{
          text: [
            'You create safe Vietnamese lost-and-found posts for a campus app.',
            'Return only JSON with keys: type,title,description,category,tags,verificationQuestion.',
            `type must be LOST or FOUND. category must be one of: ${CATEGORY_ENUM.join(', ')}.`,
            'Do not include private sensitive numbers from images. Keep description concise and helpful.',
          ].join(' '),
        }],
      },
      contents: [{
        role: 'user',
        parts: [{
          text: JSON.stringify({
            title: input.title,
            location: input.location,
            type: input.type,
            imageUrls: input.images,
          }),
        }],
      }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        maxOutputTokens: 500,
        responseMimeType: 'application/json',
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini API returned ${response.status}`);
  }

  const rawText = extractText(payload);
  if (!rawText) throw new Error('Gemini returned an empty auto-post response');
  return JSON.parse(stripJsonFence(rawText));
}

export async function generateLostFoundAutoPost(input) {
  try {
    const geminiDraft = await generateWithGemini(input);
    if (geminiDraft) return normalizeDraft(input, geminiDraft);
  } catch (err) {
    logger.warn(`Lost-found AI auto-post failed, using local fallback: ${err.message}`);
  }

  return normalizeDraft(input, {
    type: input.type || inferType(input.title),
    ...inferCategoryAndTags(input.title),
  });
}
