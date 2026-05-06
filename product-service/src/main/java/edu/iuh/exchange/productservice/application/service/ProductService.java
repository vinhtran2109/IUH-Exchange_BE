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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;


@Service
public class ProductService {

    private static final Logger log = LoggerFactory.getLogger(ProductService.class);

    private final ProductRepository productRepository;
    private final ProfanityFilterService profanityFilterService;
    private final ProductEventProducer eventProducer;
    private final ProductSearchRepository searchRepository;
    private final S3Service s3Service;

    public ProductService(ProductRepository productRepository, 
                          ProfanityFilterService profanityFilterService,
                          ProductEventProducer eventProducer,
                          ProductSearchRepository searchRepository,
                          S3Service s3Service) {
        this.productRepository = productRepository;
        this.profanityFilterService = profanityFilterService;
        this.eventProducer = eventProducer;
        this.searchRepository = searchRepository;
        this.s3Service = s3Service;
    }


    @Transactional
    public ProductResponse createProduct(String sellerId, CreateProductRequest request) {
        // Kiểm tra từ ngữ nhạy cảm
        if (profanityFilterService.containsProfanity(request.title()) || 
            profanityFilterService.containsProfanity(request.description())) {
            throw new edu.iuh.exchange.common.exception.BadRequestException("Nội dung chứa từ ngữ không phù hợp với môi trường học đường.");
        }

        Product product = new Product();
        product.setSellerId(sellerId);
        product.setTitle(request.title());
        product.setDescription(request.description());
        product.setPrice(request.price());
        product.setCategory(request.category());
        product.setCondition(request.condition());
        product.setImageUrls(request.imageUrls());
        product.setStatus(ProductStatus.PENDING_APPROVAL);

        // ✅ Bước 1: Lưu vào MongoDB - tác vụ quan trọng nhất, PHẢI thành công
        Product saved = productRepository.save(product);
        log.info("✅ Product saved to MongoDB: id={}, title={}", saved.getId(), saved.getTitle());

        // ✅ Bước 2: Chỉ publish Kafka SAU KHI Admin duyệt bài (Hàm resolveProductStatus)
        // Không publish ở đây để tránh hiện lên ElasticSearch khi chưa duyệt.
        log.info("✅ Product created but pending approval: {}", saved.getId());

        return ProductResponse.fromEntity(saved);
    }

    public Page<ProductResponse> getAvailableProducts(Pageable pageable) {
        return productRepository.findByStatusOrderByCreatedAtDesc(ProductStatus.AVAILABLE, pageable)
                .map(ProductResponse::fromEntity);
    }

    public ProductResponse getProductById(String id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new edu.iuh.exchange.common.exception.ResourceNotFoundException("Product", id));
        return ProductResponse.fromEntity(product);
    }

    /**
     * Tìm kiếm Fuzzy dựa vào ElasticSearch (nhanh hơn nhiều so với MongoDB)
     */
    public Page<ProductDocument> searchProducts(String keyword, Pageable pageable) {
        return searchRepository.findByTitleMatchesOrDescriptionMatchesAndStatus(
                keyword, keyword, ProductStatus.AVAILABLE, pageable);
    }

    @Transactional
    public ProductResponse updateProduct(String id, String sellerId, CreateProductRequest request) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new edu.iuh.exchange.common.exception.ResourceNotFoundException("Product", id));
        
        if (!product.getSellerId().equals(sellerId)) {
            throw new edu.iuh.exchange.common.exception.ForbiddenException("You don't have permission to update this product");
        }

        product.setTitle(request.title());
        product.setDescription(request.description());
        product.setPrice(request.price());
        product.setImageUrls(request.imageUrls());
        
        Product saved = productRepository.save(product);
        // TODO: Sync to ElasticSearch via Kafka
        return ProductResponse.fromEntity(saved);
    }

    @Transactional
    public void deleteProduct(String id, String sellerId) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new edu.iuh.exchange.common.exception.ResourceNotFoundException("Product", id));
        
        if (!product.getSellerId().equals(sellerId)) {
            throw new edu.iuh.exchange.common.exception.ForbiddenException("You don't have permission to delete this product");
        }

        // ✅ Bước 1: Xóa ảnh trên S3 để tiết kiệm dung lượng
        if (product.getImageUrls() != null) {
            product.getImageUrls().forEach(s3Service::deleteFileByUrl);
        }
        
        // ✅ Bước 2: Xóa trong Database
        productRepository.delete(product);
        
        // TODO: Sync delete to ElasticSearch
    }

    /**
     * Lấy danh sách sản phẩm của người bán cụ thể (Dùng cho Profile)
     */
    public Page<ProductResponse> getProductsBySellerId(String sellerId, Pageable pageable) {
        return productRepository.findBySellerIdOrderByCreatedAtDesc(sellerId, pageable)
                .map(ProductResponse::fromEntity);
    }

    /**
     * [ADMIN] Lấy danh sách sản phẩm chờ duyệt
     */
    public Page<ProductResponse> getPendingProducts(Pageable pageable) {
        return productRepository.findByStatusOrderByCreatedAtDesc(ProductStatus.PENDING_APPROVAL, pageable)
                .map(ProductResponse::fromEntity);
    }

    /**
     * [ADMIN] Duyệt hoặc Từ chối sản phẩm
     */
    @Transactional
    public ProductResponse resolveProductStatus(String id, String action) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new edu.iuh.exchange.common.exception.ResourceNotFoundException("Product", id));

        if ("APPROVE".equalsIgnoreCase(action)) {
            product.setStatus(ProductStatus.AVAILABLE);
        } else if ("REJECT".equalsIgnoreCase(action)) {
            product.setStatus(ProductStatus.REJECTED);
        } else {
            throw new edu.iuh.exchange.common.exception.BadRequestException("Invalid action: " + action);
        }

        Product saved = productRepository.save(product);
        
        // Nếu duyệt thành công thì publish Kafka để sync đồng thời sang ElasticSearch
        if (ProductStatus.AVAILABLE.equals(saved.getStatus())) {
            try {
                ProductEvent event = new ProductEvent(
                        saved.getId(), saved.getTitle(), saved.getDescription(),
                        saved.getPrice(), saved.getCategory(), saved.getImageUrls(), saved.getStatus()
                );
                eventProducer.publishProductCreatedEvent(event);
            } catch (Exception ignored) {}
        }
        
        return ProductResponse.fromEntity(saved);
    }

    /**
     * [ADMIN] Lấy thống kê số lượng sản phẩm
     */
    public java.util.Map<String, Object> getProductStats() {
        return java.util.Map.of(
            "total", productRepository.count(),
            "pending", productRepository.countByStatus(ProductStatus.PENDING_APPROVAL),
            "available", productRepository.countByStatus(ProductStatus.AVAILABLE),
            "sold", productRepository.countByStatus(ProductStatus.SOLD)
        );
    }
}


