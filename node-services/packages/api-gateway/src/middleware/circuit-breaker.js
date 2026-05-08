/**
 * Circuit breaker for upstream service health.
 *
 * States:
 *   CLOSED   → normal operation, requests pass through
 *   OPEN     → service is failing, reject immediately with 503
 *   HALF_OPEN → probe state, allow limited requests to test recovery
 *
 * Transitions:
 *   CLOSED → OPEN     after `failureThreshold` consecutive failures
 *   OPEN → HALF_OPEN  after `resetTimeoutMs` elapses
 *   HALF_OPEN → CLOSED  after `halfOpenMax` successful probes
 *   HALF_OPEN → OPEN    on any failure during probe
 */

import { logger } from '@iuh-exchange/common';

/**
 * @param {string} name - Service identifier for logging
 * @param {object} [opts]
 * @param {number} [opts.failureThreshold=5]
 * @param {number} [opts.resetTimeoutMs=30000]
 * @param {number} [opts.halfOpenMax=1]
 */
export function createCircuitBreaker(name, {
  failureThreshold = 5,
  resetTimeoutMs = 30_000,
  halfOpenMax = 1,
} = {}) {
  let state = 'CLOSED';
  let failureCount = 0;
  let successCount = 0;
  let lastFailureTime = 0;
  let lastStateChange = Date.now();

  function transition(newState) {
    const old = state;
    state = newState;
    lastStateChange = Date.now();
    logger.info(`[circuit:${name}] ${old} → ${newState}`);
  }

  function checkOpenToHalfOpen() {
    if (state === 'OPEN' && Date.now() - lastFailureTime >= resetTimeoutMs) {
      transition('HALF_OPEN');
      successCount = 0;
    }
  }

  return {
    /** Should this request be rejected? */
    isRejected() {
      checkOpenToHalfOpen();
      return state === 'OPEN';
    },

    /** Record a successful upstream response */
    onSuccess() {
      if (state === 'HALF_OPEN') {
        successCount++;
        if (successCount >= halfOpenMax) {
          failureCount = 0;
          transition('CLOSED');
        }
      }
      if (state === 'CLOSED') {
        failureCount = 0;
      }
    },

    /** Record an upstream failure (5xx, timeout, connection error) */
    onFailure() {
      failureCount++;
      lastFailureTime = Date.now();

      if (state === 'HALF_OPEN') {
        transition('OPEN');
        return;
      }

      if (state === 'CLOSED' && failureCount >= failureThreshold) {
        transition('OPEN');
      }
    },

    /** Current state snapshot for diagnostics */
    getState() {
      checkOpenToHalfOpen();
      return {
        state,
        failureCount,
        lastFailureTime: lastFailureTime ? new Date(lastFailureTime).toISOString() : null,
        lastStateChange: new Date(lastStateChange).toISOString(),
      };
    },
  };
}
