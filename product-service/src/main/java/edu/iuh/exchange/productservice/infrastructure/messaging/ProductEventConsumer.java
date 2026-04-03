package edu.iuh.exchange.productservice.infrastructure.messaging;

import edu.iuh.exchange.productservice.api.dto.ProductEvent;
import edu.iuh.exchange.productservice.domain.model.ProductDocument;
import edu.iuh.exchange.productservice.domain.repository.ProductSearchRepository;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class ProductEventConsumer {

    private final ProductSearchRepository searchRepository;

    public ProductEventConsumer(ProductSearchRepository searchRepository) {
        this.searchRepository = searchRepository;
    }

    /**
     * Elasticsearch Indexer: 
     * Nghe Kafka Message để tiến hành lưu bất đồng bộ vào Elasticsearch.
     */
    @KafkaListener(topics = "product.created", groupId = "product-service-group")
    public void consumeProductCreatedEvent(ProductEvent event) {
        ProductDocument doc = new ProductDocument();
        doc.setId(event.id());
        doc.setTitle(event.title());
        doc.setDescription(event.description());
        doc.setPrice(event.price());
        doc.setCategory(event.category());
        doc.setStatus(event.status());
        
        searchRepository.save(doc);
        System.out.println("✅ Đã index sản phẩm vào ElasticSearch: " + event.title());
    }
}
