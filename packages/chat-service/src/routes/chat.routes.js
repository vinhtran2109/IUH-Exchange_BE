import { authenticate, authorize, verifyGatewaySignature } from '@iuh-exchange/common';
import { Router } from 'express';
import {
  createMessage,
  getConversationHistory,
  getUserConversations,
  markConversationAsRead,
  markAllConversationsAsRead,
  listReportedMessages,
  reportMessage,
  resolveReportedMessage,
  searchMessages,
} from '../controllers/chat.controller.js';

const router = Router();

function authenticateOrGateway(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authenticate(req, res, next);
  }
  return verifyGatewaySignature(req, res, next);
}

router.use(authenticateOrGateway);

router.post('/messages', createMessage);
router.get('/admin/reported-messages', listReportedMessages);
router.patch('/admin/reported-messages/:id/resolve', resolveReportedMessage);
router.post('/messages/:id/report', authorize('CAN_REPORT'), reportMessage);
router.get('/conversations', getUserConversations);
router.get('/conversations/:conversationId', getConversationHistory);
router.patch('/conversations/:conversationId/read', markConversationAsRead);
router.patch('/conversations/read-all', markAllConversationsAsRead);
router.get('/search', searchMessages);

export default router;
