package edu.iuh.exchange.orderservice.infrastructure.messaging;

/**
 * Event phát ra khi Order được tạo.
 * Product Service sẽ lắng nghe topic này để khóa (Reserve) sản phẩm.
 */
public record OrderCreatedEvent(
        String orderId,
        String productId,
        String buyerId,
        String sellerId,
        Double price
) {}
