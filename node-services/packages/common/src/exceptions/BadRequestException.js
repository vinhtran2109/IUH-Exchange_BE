import { BaseException } from './BaseException.js';

/** 400 - Bad Request / Validation Error */
export class BadRequestException extends BaseException {
  constructor(message) {
    super(400, 'BAD_REQUEST', message);
  }
}
