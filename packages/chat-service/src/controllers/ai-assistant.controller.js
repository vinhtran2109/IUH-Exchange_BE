import { ApiResponse, BadRequestException } from '@iuh-exchange/common';
import { askAiAssistant } from '../services/ai-assistant.service.js';

const MAX_MESSAGE_LENGTH = 2000;

export async function chatWithAiAssistant(req, res, next) {
  try {
    const message = String(req.body?.message || '').trim();

    if (!message) {
      throw new BadRequestException('Message is required');
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(`Message must be at most ${MAX_MESSAGE_LENGTH} characters`);
    }

    const result = await askAiAssistant(message, {
      userId: req.user?.sub,
      locale: req.body?.locale || 'vi-VN',
    });

    res.json(ApiResponse.ok({
      message,
      answer: result.answer,
      model: result.model,
    }, 'AI assistant replied'));
  } catch (err) {
    next(err);
  }
}
