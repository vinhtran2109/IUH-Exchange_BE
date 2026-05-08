import { BaseException } from './BaseException.js';

/** 403 - Forbidden: không có quyền truy cập */
export class ForbiddenException extends BaseException {
  constructor(message = 'Forbidden') {
    super(403, 'FORBIDDEN', message);
  }
}
