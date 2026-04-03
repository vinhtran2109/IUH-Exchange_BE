package edu.iuh.exchange.productservice.infrastructure.messaging;

import edu.iuh.exchange.productservice.api.dto.ProductEvent;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class ProductEventProducer {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public ProductEventProducer(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publishProductCreatedEvent(ProductEvent event) {
        // Send to topic "product.created"
        kafkaTemplate.send("product.created", event.id(), event);
    }
}
