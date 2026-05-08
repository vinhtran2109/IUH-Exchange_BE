/**
 * Chuẩn hóa format response cho toàn bộ API hệ thống.
 * Mọi response đều phải được bọc trong ApiResponse này.
 *
 * {
 *   "success": true,
 *   "statusCode": 200,
 *   "message": "OK",
 *   "data": { ... },
 *   "timestamp": "2024-01-01T00:00:00Z"
 * }
 */
export class ApiResponse {
  /**
   * @param {object} options
   * @param {boolean} options.success
   * @param {number} options.statusCode
   * @param {string} options.message
   * @param {*} [options.data]
   */
  constructor({ success, statusCode, message, data }) {
    this.success = success;
    this.statusCode = statusCode;
    this.message = message;
    if (data !== undefined) this.data = data;
    this.timestamp = new Date().toISOString();
  }

  static ok(data, message = 'Success') {
    return new ApiResponse({ success: true, statusCode: 200, message, data });
  }

  static created(data, message = 'Created') {
    return new ApiResponse({ success: true, statusCode: 201, message, data });
  }

  static error(statusCode, message) {
    return new ApiResponse({ success: false, statusCode, message });
  }
}
