import { BaseException } from './BaseException.js';

/** 429 - Too Many Requests / Rate Limit */
export class TooManyRequestsException extends BaseException {
  constructor(message = 'Too many requests. Please try again later.') {
    super(429, 'TOO_MANY_REQUESTS', message);
  }
}
