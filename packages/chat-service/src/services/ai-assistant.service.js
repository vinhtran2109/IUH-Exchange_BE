import { logger } from '@iuh-exchange/common';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_OUTPUT_TOKENS = 700;
const MAX_TOOL_ROUNDS = 3;
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002';
const LOSTFOUND_SERVICE_URL = process.env.LOSTFOUND_SERVICE_URL || 'http://lost-found-service:3006';
const API_GATEWAY_URL = process.env.API_GATEWAY_URL || process.env.GATEWAY_URL || 'http://api-gateway:8080';

const SYSTEM_INSTRUCTION = `
You are IUH Exchange AI Assistant, a helpful Vietnamese assistant for a campus marketplace app.
Help IUH students buy, sell, trade, and handle lost-and-found items safely.
Keep answers practical, concise, and friendly.
Do not ask for sensitive information such as passwords, OTPs, bank card numbers, or private keys.
When users ask about pricing, scams, listings, or descriptions, give actionable advice.
When users ask to find products, lost-and-found posts, or their orders, use the available tools first.
After using tools, summarize only the most relevant results and include useful next actions.
If the user asks for illegal, unsafe, or abusive actions, refuse briefly and suggest a safe alternative.
`.trim();

const TOOL_DECLARATIONS = [
  {
    name: 'searchProductsTool',
    description: 'Search available marketplace products by keyword, category, price, condition, or location.',
    parameters: {
      type: 'OBJECT',
      properties: {
        keyword: { type: 'STRING', description: 'Product keyword, for example laptop, tai nghe, sách.' },
        category: { type: 'STRING', description: 'Optional product category.' },
        condition: { type: 'STRING', description: 'Optional product condition.' },
        location: { type: 'STRING', description: 'Optional campus location.' },
        minPrice: { type: 'NUMBER', description: 'Optional minimum price in VND.' },
        maxPrice: { type: 'NUMBER', description: 'Optional maximum price in VND.' },
        sort: { type: 'STRING', description: 'Optional sort: date_desc, date_asc, price_asc, price_desc.' },
        page: { type: 'NUMBER', description: 'Page number, default 1.' },
        size: { type: 'NUMBER', description: 'Page size, default 5, max 10.' },
      },
    },
  },
  {
    name: 'searchLostFoundTool',
    description: 'Search lost-and-found posts by keyword, type, status, or category.',
    parameters: {
      type: 'OBJECT',
      properties: {
        keyword: { type: 'STRING', description: 'Lost/found item keyword, for example ví, chìa khóa, thẻ sinh viên.' },
        type: { type: 'STRING', description: 'Optional type: LOST or FOUND.' },
        status: { type: 'STRING', description: 'Optional status: OPEN, CLAIMED, RESOLVED, CLOSED.' },
        category: { type: 'STRING', description: 'Optional category: ELECTRONICS, ACCESSORIES, CLOTHING, DOCUMENTS, KEYS, BAGS, OTHER.' },
        page: { type: 'NUMBER', description: 'Page number, default 1.' },
        size: { type: 'NUMBER', description: 'Page size, default 5, max 10.' },
      },
    },
  },
  {
    name: 'getMyOrdersTool',
    description: 'Get the authenticated user orders where they are buyer or seller.',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'NUMBER', description: 'Maximum number of orders to return, default 5, max 10.' },
        status: { type: 'STRING', description: 'Optional status filter such as AWAITING_SELLER, COMPLETED, CANCELLED.' },
      },
    },
  },
];

function getGeminiConfig() {
  return {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
  };
}

function extractGeminiText(payload) {
  return payload?.candidates
    ?.flatMap((candidate) => candidate?.content?.parts || [])
    ?.map((part) => part?.text || '')
    ?.join('')
    ?.trim();
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function appendQuery(url, params) {
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.message || `Request failed with ${response.status}`);
  }
  return body;
}

function getListPayload(body) {
  const data = body?.data;
  if (Array.isArray(data)) return { items: data, total: data.length };
  if (Array.isArray(data?.content)) return { items: data.content, total: data.totalElements ?? data.content.length };
  if (Array.isArray(data?.data?.content)) return { items: data.data.content, total: data.data.totalElements ?? data.data.content.length };
  return { items: [], total: 0 };
}

function compactProduct(product) {
  const id = product.id || product._id;
  return {
    id,
    title: product.title,
    price: product.price,
    category: product.category,
    condition: product.condition,
    location: product.location,
    sellerName: product.sellerName || product.seller?.name || '',
    imageUrl: product.imageUrls?.[0] || '',
    url: id ? `/products/${id}` : '',
  };
}

function compactLostFoundItem(item) {
  const id = item.id || item._id;
  return {
    id,
    type: item.type,
    title: item.title,
    status: item.status,
    category: item.category,
    location: item.location,
    userName: item.userName || '',
    studentId: item.studentId || '',
    imageUrl: item.imageUrls?.[0] || item.images?.[0] || '',
    url: id ? `/lost-found/${id}` : '',
  };
}

function compactOrder(order) {
  const id = order.id || order._id;
  return {
    id,
    productTitle: order.productTitle || order.product?.title || '',
    price: order.price || order.amount || order.product?.price,
    status: order.status,
    paymentStatus: order.paymentStatus,
    buyerName: order.buyerName || order.buyer?.name || '',
    sellerName: order.sellerName || order.seller?.name || '',
    createdAt: order.createdAt,
    url: id ? `/orders/${id}` : '',
  };
}

export async function searchProductsTool(args = {}) {
  const size = clampNumber(args.size, 5, 1, 10);
  const page = clampNumber(args.page, 1, 1, 50);
  const url = appendQuery(new URL('/api/v1/products/search', PRODUCT_SERVICE_URL), {
    keyword: args.keyword || '',
    category: args.category,
    condition: args.condition,
    location: args.location,
    minPrice: args.minPrice,
    maxPrice: args.maxPrice,
    sort: args.sort,
    page,
    size,
  });

  const body = await fetchJson(url);
  const { items, total } = getListPayload(body);
  return {
    total,
    items: items.slice(0, size).map(compactProduct),
  };
}

export async function searchLostFoundTool(args = {}) {
  const size = clampNumber(args.size, 5, 1, 10);
  const page = clampNumber(args.page, 1, 1, 50);
  const url = appendQuery(new URL('/api/v1/lost-found', LOSTFOUND_SERVICE_URL), {
    keyword: args.keyword || '',
    type: args.type,
    status: args.status || 'OPEN',
    category: args.category,
    page,
    size,
  });

  const body = await fetchJson(url);
  const { items, total } = getListPayload(body);
  return {
    total,
    items: items.slice(0, size).map(compactLostFoundItem),
  };
}

export async function getMyOrdersTool(args = {}, context = {}) {
  if (!context.authHeader) {
    return {
      total: 0,
      items: [],
      error: 'Người dùng cần đăng nhập để xem đơn hàng.',
    };
  }

  const limit = clampNumber(args.limit || args.size, 5, 1, 10);
  const body = await fetchJson(new URL('/api/v1/orders/my-orders', API_GATEWAY_URL), {
    headers: { Authorization: context.authHeader },
  });
  const { items } = getListPayload(body);
  const filtered = args.status ? items.filter((order) => order.status === args.status) : items;
  return {
    total: filtered.length,
    items: filtered.slice(0, limit).map(compactOrder),
  };
}

async function runTool(name, args, context) {
  switch (name) {
    case 'searchProductsTool':
      return searchProductsTool(args);
    case 'searchLostFoundTool':
      return searchLostFoundTool(args);
    case 'getMyOrdersTool':
      return getMyOrdersTool(args, context);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function buildGeminiRequest(contents) {
  return {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents,
    tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
    generationConfig: {
      temperature: 0.5,
      topP: 0.9,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  };
}

async function callGemini(model, apiKey, contents) {
  const response = await fetch(`${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildGeminiRequest(contents)),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = payload?.error?.message || `Gemini API returned ${response.status}`;
    logger.warn(`AI Assistant request failed: ${reason}`);
    throw new Error(reason);
  }
  return payload;
}

export async function askAiAssistant(message, context = {}) {
  const { apiKey, model } = getGeminiConfig();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const userContext = [
    context.userId ? `User ID: ${context.userId}` : '',
    context.locale ? `Locale: ${context.locale}` : 'Locale: vi-VN',
  ].filter(Boolean).join('\n');

  const contents = [{
    role: 'user',
    parts: [{
      text: `${userContext}\n\nUser message:\n${message}`,
    }],
  }];

  const toolCalls = [];
  let payload = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    payload = await callGemini(model, apiKey, contents);
    const parts = payload?.candidates?.[0]?.content?.parts || [];
    const functionCalls = parts.map((part) => part.functionCall).filter(Boolean);

    if (functionCalls.length === 0) break;

    const functionResponses = await Promise.all(functionCalls.map(async (functionCall) => {
      const args = functionCall.args || {};
      let result;
      try {
        result = await runTool(functionCall.name, args, context);
      } catch (err) {
        result = { error: err.message || 'Tool execution failed' };
      }

      toolCalls.push({ name: functionCall.name, args, result });
      return {
        functionResponse: {
          name: functionCall.name,
          response: result,
        },
      };
    }));

    contents.push({ role: 'model', parts: functionCalls.map((functionCall) => ({ functionCall })) });
    contents.push({
      role: 'user',
      parts: functionResponses,
    });
  }

  const answer = extractGeminiText(payload);
  if (!answer) {
    throw new Error('Gemini returned an empty response');
  }

  return {
    answer,
    model,
    toolCalls,
  };
}
