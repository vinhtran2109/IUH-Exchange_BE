import { BaseException } from './BaseException.js';

/** 409 - Conflict (duplicate, idempotency, etc.) */
export class ConflictException extends BaseException {
  constructor(message = 'Conflict') {
    super(409, 'CONFLICT', message);
  }
}
