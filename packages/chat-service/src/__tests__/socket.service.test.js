import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildConversationId } from '../services/socket.service.js';

describe('chat-service socket.service', () => {
  describe('buildConversationId', () => {
    it('should create deterministic conversation ID from two user IDs', () => {
      const id = buildConversationId('user-abc', 'user-xyz');
      expect(id).toBe('user-abc:user-xyz');
    });

    it('should produce same ID regardless of argument order', () => {
      const id1 = buildConversationId('user-abc', 'user-xyz');
      const id2 = buildConversationId('user-xyz', 'user-abc');
      expect(id1).toBe(id2);
    });

    it('should sort user IDs lexicographically', () => {
      const id = buildConversationId('bbb', 'aaa');
      expect(id).toBe('aaa:bbb');
    });

    it('should handle numeric IDs', () => {
      const id = buildConversationId('123', '456');
      expect(id).toBe('123:456');
    });

    it('should handle same user ID', () => {
      const id = buildConversationId('user-1', 'user-1');
      expect(id).toBe('user-1:user-1');
    });
  });
});
