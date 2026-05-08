import { authenticate } from '@iuh-exchange/common';
import { Router } from 'express';
import {
  getConversationHistory,
  getUserConversations,
  markConversationAsRead,
  markAllConversationsAsRead,
} from '../controllers/chat.controller.js';

const router = Router();

router.use(authenticate);

router.get('/conversations', getUserConversations);
router.get('/conversations/:conversationId', getConversationHistory);
router.patch('/conversations/:conversationId/read', markConversationAsRead);
router.patch('/conversations/read-all', markAllConversationsAsRead);

export default router;
