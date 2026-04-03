package edu.iuh.exchange.orderservice.domain.model;

public enum OrderStatus {
    /** Đơn hàng vừa được tạo, chờ xác nhận từ Product Service */
    PENDING,
    /** Product đã bị khóa (RESERVED), chờ 2 bên xác nhận hoàn tất */
    CONFIRMED,
    /** Giao dịch hoàn tất, KarmaPoint đã được cộng/trừ */
    COMPLETED,
    /** Đơn hàng bị hủy (do lỗi, hoặc 1 bên từ chối) */
    CANCELLED
}
