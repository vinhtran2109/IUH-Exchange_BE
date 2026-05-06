package edu.iuh.exchange.orderservice.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateOrderRequest(
        @NotBlank(message = "productId is required")
        String productId,

        @NotBlank(message = "sellerId is required")
        String sellerId,

        @NotNull(message = "price is required")
        Double price,

        String buyerNote,

        /**
         * Idempotency Key: UUID sinh ra từ Frontend mỗi lần bấm nút Mua.
         * Nếu request bị gửi 2 lần (do lag), server nhận ra Key cũ và trả về Order cũ → chống Duplicate.
         */
        @NotBlank(message = "idempotencyKey is required")
        String idempotencyKey
) {}
