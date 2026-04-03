package edu.iuh.exchange.productservice.domain.model;

public enum ProductStatus {
    AVAILABLE,      // Đang bán
    PENDING,        // Đang giao dịch (bị khóa bởi Order Service)
    SOLD,           // Đã bán
    HIDDEN,         // Người bán tự ẩn
    REJECTED        // Bị Admin/Hệ thống từ chối do vi phạm
}
