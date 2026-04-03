package edu.iuh.exchange.productservice.infrastructure.messaging;

import edu.iuh.exchange.productservice.domain.model.ProductStatus;
import edu.iuh.exchange.productservice.domain.repository.ProductRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * SAGA Consumer ở Product Service:
 * Lắng nghe "order.created" → Khóa sản phẩm (PENDING) →
 *   Thành công → Phát "product.reserved"
 *   Thất bại   → Phát "product.reserve.failed" (Compensating Transaction)
 */
@Component
public class OrderSagaListener {

    private static final Logger log = LoggerFactory.getLogger(OrderSagaListener.class);

    private final ProductRepository productRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public OrderSagaListener(ProductRepository productRepository,
                              KafkaTemplate<String, Object> kafkaTemplate) {
        this.productRepository = productRepository;
        this.kafkaTemplate = kafkaTemplate;
    }

    @KafkaListener(topics = "order.created", groupId = "product-service-saga-group-v2")
    public void onOrderCreated(Map<String, Object> payload) {
        String orderId   = (String) payload.get("orderId");
        String productId = (String) payload.get("productId");

        log.info("🔔 [SAGA] Received OrderCreatedEvent: orderId={}, productId={}", orderId, productId);

        productRepository.findById(productId).ifPresentOrElse(product -> {
            if (ProductStatus.AVAILABLE.equals(product.getStatus())) {
                // ✅ Sản phẩm còn → Khóa lại (PENDING = đang trong giao dịch)
                product.setStatus(ProductStatus.PENDING);
                productRepository.save(product);
                log.info("🔒 [SAGA] Product reserved: productId={}", productId);

                // Báo về cho Order Service
                Map<String, String> successPayload = new HashMap<>();
                successPayload.put("orderId", orderId);
                successPayload.put("productId", productId);
                kafkaTemplate.send("product.reserved", orderId, successPayload);

            } else {
                // ❌ Sản phẩm không còn khả dụng (đã bán / đang trong GD khác)
                log.warn("❌ [SAGA] Product not available: productId={}, status={}", productId, product.getStatus());
                sendReserveFailed(orderId, productId, "Sản phẩm không còn khả dụng (status=" + product.getStatus() + ")");
            }
        }, () -> {
            // ❌ Không tìm thấy sản phẩm
            log.warn("❌ [SAGA] Product not found: productId={}", productId);
            sendReserveFailed(orderId, productId, "Không tìm thấy sản phẩm");
        });
    }

    private void sendReserveFailed(String orderId, String productId, String reason) {
        Map<String, String> failPayload = new HashMap<>();
        failPayload.put("orderId", orderId);
        failPayload.put("productId", productId);
        failPayload.put("reason", reason);
        kafkaTemplate.send("product.reserve.failed", orderId, failPayload);
    }
}
