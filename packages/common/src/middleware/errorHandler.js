import { ApiResponse } from '../dto/ApiResponse.js';
import { BaseException } from '../exceptions/BaseException.js';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

/**
 * Centralized Error Handler middleware.
 * Xử lý lỗi format chung cho toàn bộ APIs.
 * Mọi service đều mount middleware này.
 */
export function errorHandler(err, req, res, _next) {
  // Business exceptions (extends BaseException)
  if (err instanceof BaseException) {
    logger.warn(`[${err.status}] ${err.errorCode}: ${err.message}`);
    return res.status(err.status).json(ApiResponse.error(err.status, err.message));
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    const errors = {};
    for (const issue of err.issues) {
      const field = issue.path.join('.');
      errors[field] = issue.message;
    }
    logger.warn(`[400] Validation failed:`, errors);
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'Validation failed',
      data: errors,
      timestamp: new Date().toISOString(),
    });
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const errors = {};
    for (const [field, detail] of Object.entries(err.errors)) {
      errors[field] = detail.message;
    }
    logger.warn(`[400] Mongoose validation:`, errors);
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'Validation failed',
      data: errors,
      timestamp: new Date().toISOString(),
    });
  }

  if (err.name === 'CastError') {
    logger.warn(`[400] Cast error on ${err.path}: ${err.value}`);
    return res.status(400).json(ApiResponse.error(400, `Invalid value for: ${err.path}`));
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern).join(', ');
    logger.warn(`[409] Duplicate key: ${field}`);
    return res.status(409).json(ApiResponse.error(409, `Duplicate value for: ${field}`));
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json(ApiResponse.error(401, 'Invalid or expired token'));
  }

  // Fallback: unhandled errors
  logger.error(`[500] Unhandled exception: ${err.message}`, { stack: err.stack });
  return res.status(500).json(ApiResponse.error(500, 'An unexpected error occurred. Please try again later.'));
}
