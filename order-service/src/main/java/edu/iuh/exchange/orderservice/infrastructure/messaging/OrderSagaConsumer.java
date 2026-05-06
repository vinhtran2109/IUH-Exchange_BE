package edu.iuh.exchange.orderservice.infrastructure.messaging;

import edu.iuh.exchange.orderservice.application.service.OrderService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * SAGA Consumer: Lắng nghe phản hồi từ Product Service.
 *
 * Luồng SAGA:
 *  Order Service  ──────(order.created)──────▶  Product Service
 *  Order Service  ◀────(product.reserved)──────  Product Service  [thành công]
 *  Order Service  ◀───(product.reserve.failed)─  Product Service  [thất bại → Rollback]
 */
@Component
public class OrderSagaConsumer {

    private static final Logger log = LoggerFactory.getLogger(OrderSagaConsumer.class);
    private final OrderService orderService;

    public OrderSagaConsumer(OrderService orderService) {
        this.orderService = orderService;
    }

    /**
     * Product đã được khóa thành công → Đơn chờ người bán xác nhận.
     */
    @KafkaListener(topics = OrderTopics.PRODUCT_RESERVED, groupId = "order-service-group")
    public void onProductReserved(Map<String, String> payload) {
        String orderId = payload.get("orderId");
        log.info("✅ [SAGA Step 2] Product reserved for orderId={}", orderId);
        orderService.markAwaitingSellerConfirmation(orderId);
    }

    /**
     * Product Reserve thất bại (hết hàng, bị người khác mua trước)
     * → Compensating Transaction: Hủy Order
     */
    @KafkaListener(topics = OrderTopics.PRODUCT_RESERVE_FAILED, groupId = "order-service-group")
    public void onProductReserveFailed(Map<String, String> payload) {
        String orderId = payload.get("orderId");
        String reason  = payload.getOrDefault("reason", "Sản phẩm không còn khả dụng");
        log.warn("❌ [SAGA Rollback] Product reserve failed for orderId={}, reason={}", orderId, reason);
        orderService.cancelOrder(orderId, reason);
    }
}
