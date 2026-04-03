package edu.iuh.exchange.orderservice.infrastructure.messaging;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class OrderEventProducer {

    private static final Logger log = LoggerFactory.getLogger(OrderEventProducer.class);
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public OrderEventProducer(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publishOrderCreated(OrderCreatedEvent event) {
        try {
            kafkaTemplate.send(OrderTopics.ORDER_CREATED, event.orderId(), event);
            log.info("📨 [SAGA] OrderCreatedEvent published: orderId={}", event.orderId());
        } catch (Exception e) {
            log.warn("⚠️ Kafka unavailable, OrderCreatedEvent not published: {}", e.getMessage());
        }
    }

    public void publishOrderCancelled(String orderId, String reason) {
        try {
            kafkaTemplate.send(OrderTopics.ORDER_CANCELLED, orderId,
                    new java.util.HashMap<>(java.util.Map.of("orderId", orderId, "reason", reason)));
            log.info("📨 [SAGA] OrderCancelledEvent published: orderId={}", orderId);
        } catch (Exception e) {
            log.warn("⚠️ Kafka unavailable, OrderCancelledEvent not published: {}", e.getMessage());
        }
    }
    public void publishOrderCompleted(String orderId, String buyerId, String sellerId) {
        try {
            kafkaTemplate.send(OrderTopics.ORDER_COMPLETED, orderId,
                    new java.util.HashMap<>(java.util.Map.of(
                            "orderId", orderId,
                            "buyerId", buyerId,
                            "sellerId", sellerId
                    )));
            log.info("📨 [SAGA] OrderCompletedEvent published: orderId={}, buyerId={}, sellerId={}", orderId, buyerId, sellerId);
        } catch (Exception e) {
            log.warn("⚠️ Kafka unavailable, OrderCompletedEvent not published: {}", e.getMessage());
        }
    }
}
