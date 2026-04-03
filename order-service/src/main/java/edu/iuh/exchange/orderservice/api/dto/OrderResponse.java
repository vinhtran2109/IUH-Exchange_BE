package edu.iuh.exchange.orderservice.api.dto;

import edu.iuh.exchange.orderservice.domain.model.OrderStatus;

import java.time.Instant;

public record OrderResponse(
        String id,
        String buyerId,
        String sellerId,
        String productId,
        Double price,
        OrderStatus status,
        String buyerNote,
        Instant createdAt,
        Instant updatedAt
) {
    public static OrderResponse fromEntity(edu.iuh.exchange.orderservice.domain.model.Order order) {
        return new OrderResponse(
                order.getId(),
                order.getBuyerId(),
                order.getSellerId(),
                order.getProductId(),
                order.getPrice(),
                order.getStatus(),
                order.getBuyerNote(),
                order.getCreatedAt(),
                order.getUpdatedAt()
        );
    }
}
