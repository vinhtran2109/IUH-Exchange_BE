/**
 * Chuẩn hóa format phân trang cho các API Listing.
 * Ví dụ: GET /api/v1/products?page=1&size=20
 */
export class PageResponse {
  /**
   * @param {object} options
   * @param {Array} options.content
   * @param {number} options.page
   * @param {number} options.size
   * @param {number} options.totalElements
   * @param {number} options.totalPages
   * @param {boolean} options.last
   */
  constructor({ content, page, size, totalElements, totalPages, last }) {
    this.content = content;
    this.page = page;
    this.size = size;
    this.totalElements = totalElements;
    this.totalPages = totalPages;
    this.last = last;
  }

  /**
   * Tạo PageResponse từ Mongoose paginate result
   */
  static fromMongoose(result, page, size) {
    return new PageResponse({
      content: result.docs || result,
      page,
      size,
      totalElements: result.totalDocs || 0,
      totalPages: result.totalPages || 0,
      last: result.hasNextPage === false,
    });
  }
}
