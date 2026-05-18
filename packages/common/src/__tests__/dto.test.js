import { describe, it, expect } from 'vitest';
import { ApiResponse } from '../dto/ApiResponse.js';
import { PageResponse } from '../dto/PageResponse.js';

describe('ApiResponse', () => {
  describe('ok', () => {
    it('should create success response with data', () => {
      const response = ApiResponse.ok({ name: 'test' }, 'Success');

      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(200);
      expect(response.message).toBe('Success');
      expect(response.data).toEqual({ name: 'test' });
      expect(response.timestamp).toBeDefined();
    });

    it('should use default message when not provided', () => {
      const response = ApiResponse.ok({ id: 1 });

      expect(response.message).toBe('Success');
      expect(response.data).toEqual({ id: 1 });
    });

    it('should handle null data', () => {
      const response = ApiResponse.ok(null);

      expect(response.success).toBe(true);
      expect(response.data).toBeNull();
    });
  });

  describe('created', () => {
    it('should create 201 response', () => {
      const response = ApiResponse.created({ id: '123' }, 'Created successfully');

      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(201);
      expect(response.message).toBe('Created successfully');
      expect(response.data).toEqual({ id: '123' });
    });
  });

  describe('error', () => {
    it('should create error response', () => {
      const response = ApiResponse.error(400, 'Bad request');

      expect(response.success).toBe(false);
      expect(response.statusCode).toBe(400);
      expect(response.message).toBe('Bad request');
      expect(response.timestamp).toBeDefined();
    });

    it('should handle 500 errors', () => {
      const response = ApiResponse.error(500, 'Internal server error');

      expect(response.success).toBe(false);
      expect(response.statusCode).toBe(500);
    });
  });
});

describe('PageResponse', () => {
  it('should create paginated response', () => {
    const response = new PageResponse({
      content: [{ id: 1 }, { id: 2 }],
      page: 1,
      size: 10,
      totalElements: 25,
      totalPages: 3,
      last: false,
    });

    expect(response.content).toEqual([{ id: 1 }, { id: 2 }]);
    expect(response.page).toBe(1);
    expect(response.size).toBe(10);
    expect(response.totalElements).toBe(25);
    expect(response.totalPages).toBe(3);
    expect(response.last).toBe(false);
  });

  it('should mark last page correctly', () => {
    const response = new PageResponse({
      content: [],
      page: 3,
      size: 10,
      totalElements: 25,
      totalPages: 3,
      last: true,
    });

    expect(response.last).toBe(true);
  });

  it('should handle empty results', () => {
    const response = new PageResponse({
      content: [],
      page: 1,
      size: 10,
      totalElements: 0,
      totalPages: 0,
      last: true,
    });

    expect(response.content).toEqual([]);
    expect(response.totalElements).toBe(0);
    expect(response.totalPages).toBe(0);
    expect(response.last).toBe(true);
  });

  it('should handle first page with fewer items than page size', () => {
    const response = new PageResponse({
      content: [{ id: 1 }],
      page: 1,
      size: 10,
      totalElements: 1,
      totalPages: 1,
      last: true,
    });

    expect(response.totalPages).toBe(1);
    expect(response.last).toBe(true);
  });

  describe('fromMongoose', () => {
    it('should create PageResponse from Mongoose paginate result', () => {
      const result = {
        docs: [{ id: 1 }, { id: 2 }],
        totalDocs: 50,
        totalPages: 5,
        hasNextPage: true,
      };

      const response = PageResponse.fromMongoose(result, 1, 10);

      expect(response.content).toEqual([{ id: 1 }, { id: 2 }]);
      expect(response.page).toBe(1);
      expect(response.size).toBe(10);
      expect(response.totalElements).toBe(50);
      expect(response.totalPages).toBe(5);
      expect(response.last).toBe(false);
    });
  });
});
