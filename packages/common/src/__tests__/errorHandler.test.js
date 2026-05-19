import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZodError, z } from 'zod';
import { errorHandler } from '../middleware/errorHandler.js';
import { BadRequestException } from '../exceptions/BadRequestException.js';
import { ResourceNotFoundException } from '../exceptions/ResourceNotFoundException.js';
import { UnauthorizedException } from '../exceptions/UnauthorizedException.js';
import { ForbiddenException } from '../exceptions/ForbiddenException.js';
import { ConflictException } from '../exceptions/ConflictException.js';

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('errorHandler middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  it('should handle BaseException subclasses', () => {
    const err = new BadRequestException('Invalid input');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 400,
        message: 'Invalid input',
      })
    );
  });

  it('should handle ResourceNotFoundException', () => {
    const err = new ResourceNotFoundException('User', '123');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should handle UnauthorizedException', () => {
    const err = new UnauthorizedException('Not authenticated');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should handle ForbiddenException', () => {
    const err = new ForbiddenException('Access denied');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should handle ConflictException', () => {
    const err = new ConflictException('Resource exists');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('should handle ZodError', () => {
    // Create a real ZodError by attempting to parse with an invalid schema
    const schema = z.object({ email: z.string().email() });
    let zodErr;
    try {
      schema.parse({ email: 'not-an-email' });
    } catch (e) {
      zodErr = e;
    }

    errorHandler(zodErr, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Validation failed',
      })
    );
  });

  it('should handle Mongoose ValidationError', () => {
    const err = new Error('Validation failed');
    err.name = 'ValidationError';
    err.errors = {
      email: { message: 'Email is required' },
      name: { message: 'Name is required' },
    };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Validation failed',
      })
    );
  });

  it('should handle Mongoose CastError', () => {
    const err = new Error('Cast failed');
    err.name = 'CastError';
    err.path = '_id';
    err.value = 'invalid-id';

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should handle duplicate key error (code 11000)', () => {
    const err = new Error('Duplicate key');
    err.code = 11000;
    err.keyPattern = { email: 1 };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('should handle JWT errors', () => {
    const err = new Error('Invalid token');
    err.name = 'JsonWebTokenError';

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should handle expired JWT tokens', () => {
    const err = new Error('Token expired');
    err.name = 'TokenExpiredError';

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should handle unknown errors with 500', () => {
    const err = new Error('Something unexpected');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 500,
        message: 'An unexpected error occurred. Please try again later.',
      })
    );
  });
});
