/**
 * Base exception cho toàn bộ microservices.
 * Mọi business exception đều extend từ class này.
 */
export class BaseException extends Error {
  /**
   * @param {number} status - HTTP status code
   * @param {string} errorCode - Business error code
   * @param {string} message - Human-readable message
   */
  constructor(status, errorCode, message) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.errorCode = errorCode;
    Error.captureStackTrace(this, this.constructor);
  }
}
