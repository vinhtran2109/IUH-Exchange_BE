package edu.iuh.exchange.productservice.application.service;

import edu.iuh.exchange.productservice.api.dto.CreateProductRequest;
import edu.iuh.exchange.productservice.api.dto.ProductEvent;
import edu.iuh.exchange.productservice.api.dto.ProductResponse;
import edu.iuh.exchange.productservice.domain.model.Product;
import edu.iuh.exchange.productservice.domain.model.ProductStatus;
import edu.iuh.exchange.productservice.domain.repository.ProductRepository;
import edu.iuh.exchange.productservice.domain.model.ProductDocument;
import edu.iuh.exchange.productservice.domain.repository.ProductSearchRepository;
import edu.iuh.exchange.productservice.infrastructure.messaging.ProductEventProducer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final ProfanityFilterService profanityFilterService;
    private final ProductEventProducer eventProducer;
    private final ProductSearchRepository searchRepository;

    public ProductService(ProductRepository productRepository, 
                          ProfanityFilterService profanityFilterService,
                          ProductEventProducer eventProducer,
                          ProductSearchRepository searchRepository) {
        this.productRepository = productRepository;
        this.profanityFilterService = profanityFilterService;
        this.eventProducer = eventProducer;
        this.searchRepository = searchRepository;
    }

    @Transactional
    public ProductResponse createProduct(String sellerId, CreateProductRequest request) {
        // Kiểm tra từ ngữ nhạy cảm
        if (profanityFilterService.containsProfanity(request.title()) || 
            profanityFilterService.containsProfanity(request.description())) {
            throw new IllegalArgumentException("Nội dung chứa từ ngữ không phù hợp với môi trường học đường.");
        }

        Product product = new Product();
        product.setSellerId(sellerId);
        product.setTitle(request.title());
        product.setDescription(request.description());
        product.setPrice(request.price());
        product.setCategory(request.category());
        product.setCondition(request.condition());
        product.setImageUrls(request.imageUrls());
        product.setStatus(ProductStatus.AVAILABLE);

        Product saved = productRepository.save(product);
        
        // Phát Event sang Kafka để ElasticSearch lặp chỉ mục (Indexer)
        ProductEvent event = new ProductEvent(
                saved.getId(), saved.getTitle(), saved.getDescription(),
                saved.getPrice(), saved.getCategory(), saved.getStatus()
        );
        eventProducer.publishProductCreatedEvent(event);

        return ProductResponse.fromEntity(saved);
    }

    public Page<ProductResponse> getAvailableProducts(Pageable pageable) {
        return productRepository.findByStatusOrderByCreatedAtDesc(ProductStatus.AVAILABLE, pageable)
                .map(ProductResponse::fromEntity);
    }

    public ProductResponse getProductById(String id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy sản phẩm có ID: " + id));
        return ProductResponse.fromEntity(product);
    }

    /**
     * Tìm kiếm Fuzzy dựa vào ElasticSearch (nhanh hơn nhiều so với MongoDB)
     */
    public Page<ProductDocument> searchProducts(String keyword, Pageable pageable) {
        return searchRepository.findByTitleMatchesOrDescriptionMatchesAndStatus(
                keyword, keyword, ProductStatus.AVAILABLE, pageable);
    }
}
