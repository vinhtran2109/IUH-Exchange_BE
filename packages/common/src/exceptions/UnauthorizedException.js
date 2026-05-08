import { BaseException } from './BaseException.js';

/** 401 - Unauthorized */
export class UnauthorizedException extends BaseException {
  constructor(message = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message);
  }
}
