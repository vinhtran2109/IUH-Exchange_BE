import { logger } from '@iuh-exchange/common';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_OUTPUT_TOKENS = 700;

const SYSTEM_INSTRUCTION = `
You are IUH Exchange AI Assistant, a helpful Vietnamese assistant for a campus marketplace app.
Help IUH students buy, sell, trade, and handle lost-and-found items safely.
Keep answers practical, concise, and friendly.
Do not ask for sensitive information such as passwords, OTPs, bank card numbers, or private keys.
When users ask about pricing, scams, listings, or descriptions, give actionable advice.
If the user asks for illegal, unsafe, or abusive actions, refuse briefly and suggest a safe alternative.
`.trim();

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

export async function askAiAssistant(message, context = {}) {
  const { apiKey, model } = getGeminiConfig();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const userContext = [
    context.userId ? `User ID: ${context.userId}` : '',
    context.locale ? `Locale: ${context.locale}` : 'Locale: vi-VN',
  ].filter(Boolean).join('\n');

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
            text: `${userContext}\n\nUser message:\n${message}`,
          }],
        },
      ],
      generationConfig: {
        temperature: 0.5,
        topP: 0.9,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = payload?.error?.message || `Gemini API returned ${response.status}`;
    logger.warn(`AI Assistant request failed: ${reason}`);
    throw new Error(reason);
  }

  const answer = extractGeminiText(payload);
  if (!answer) {
    throw new Error('Gemini returned an empty response');
  }

  return {
    answer,
    model,
  };
}
