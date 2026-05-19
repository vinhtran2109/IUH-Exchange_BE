import { describe, it, expect } from 'vitest';
import { containsProfanity } from '../services/profanity-filter.js';

describe('profanity-filter', () => {
  describe('containsProfanity', () => {
    it('should return false for clean text', () => {
      expect(containsProfanity('iPhone 15 Pro Max mới 99%')).toBe(false);
      expect(containsProfanity('Bán laptop Dell giá rẻ')).toBe(false);
      expect(containsProfanity('Tìm ví da màu nâu')).toBe(false);
    });

    it('should return true for text with profanity', () => {
      expect(containsProfanity('Đồ lừa đảo')).toBe(true);
      expect(containsProfanity('This is a scam')).toBe(true);
    });

    it('should return false for null or empty text', () => {
      expect(containsProfanity(null)).toBe(false);
      expect(containsProfanity('')).toBe(false);
      expect(containsProfanity('   ')).toBe(false);
    });

    it('should handle Vietnamese diacritics normalization', () => {
      // "lừa đảo" with different diacritic variations should still match
      expect(containsProfanity('lua dao')).toBe(true);
    });

    it('should not match partial words (word boundary check)', () => {
      // "admin" contains "dm" but should not match due to word boundaries
      expect(containsProfanity('admin')).toBe(false);
    });
  });
});
