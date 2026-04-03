package edu.iuh.exchange.common.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * Chuẩn hóa format phân trang cho các API Listing.
 * Ví dụ: GET /api/v1/products?page=1&size=20
 */
@Getter
@Builder
public class PageResponse<T> {

    private final List<T> content;
    private final int page;
    private final int size;
    private final long totalElements;
    private final int totalPages;
    private final boolean last;
}
