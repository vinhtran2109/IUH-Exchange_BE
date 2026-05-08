import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCircuitBreaker } from '../middleware/circuit-breaker.js';

describe('circuit-breaker', () => {
  describe('createCircuitBreaker', () => {
    it('should start in CLOSED state', () => {
      const breaker = createCircuitBreaker('test-service', {
        failureThreshold: 3,
        resetTimeoutMs: 5000,
        halfOpenMax: 1,
      });

      expect(breaker.isRejected()).toBe(false);
      const state = breaker.getState();
      expect(state.state).toBe('CLOSED');
    });

    it('should open after failure threshold', () => {
      const breaker = createCircuitBreaker('test-service', {
        failureThreshold: 3,
        resetTimeoutMs: 5000,
        halfOpenMax: 1,
      });

      // Record failures up to threshold
      breaker.onFailure();
      breaker.onFailure();
      expect(breaker.isRejected()).toBe(false); // Still closed

      breaker.onFailure();
      expect(breaker.isRejected()).toBe(true); // Now open
      expect(breaker.getState().state).toBe('OPEN');
    });

    it('should reset on success', () => {
      const breaker = createCircuitBreaker('test-service', {
        failureThreshold: 3,
        resetTimeoutMs: 5000,
        halfOpenMax: 1,
      });

      breaker.onFailure();
      breaker.onFailure();
      breaker.onSuccess(); // Reset

      const state = breaker.getState();
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
    });

    it('should transition to HALF_OPEN after reset timeout', () => {
      vi.useFakeTimers();
      const breaker = createCircuitBreaker('test-service', {
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        halfOpenMax: 1,
      });

      breaker.onFailure();
      breaker.onFailure(); // Opens circuit
      expect(breaker.isRejected()).toBe(true);

      // Advance time past reset timeout
      vi.advanceTimersByTime(1500);

      // Should be half-open now, allowing one request
      expect(breaker.isRejected()).toBe(false);
      expect(breaker.getState().state).toBe('HALF_OPEN');

      vi.useRealTimers();
    });

    it('should re-open if half-open request fails', () => {
      vi.useFakeTimers();
      const breaker = createCircuitBreaker('test-service', {
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        halfOpenMax: 1,
      });

      breaker.onFailure();
      breaker.onFailure(); // Open
      vi.advanceTimersByTime(1500); // Half-open
      breaker.onFailure(); // Fail in half-open → re-open

      expect(breaker.getState().state).toBe('OPEN');
      expect(breaker.isRejected()).toBe(true);

      vi.useRealTimers();
    });
  });
});
