import { authenticate } from '@iuh-exchange/common';
import { Router } from 'express';
import { chatWithAiAssistant } from '../controllers/ai-assistant.controller.js';

const router = Router();

router.use(authenticate);

router.post('/ai', chatWithAiAssistant);

export default router;
