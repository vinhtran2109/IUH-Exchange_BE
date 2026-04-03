package edu.iuh.exchange.productservice.api.dto;

import edu.iuh.exchange.productservice.domain.model.Product;
import edu.iuh.exchange.productservice.domain.model.ProductCondition;
import edu.iuh.exchange.productservice.domain.model.ProductStatus;

import java.time.Instant;
import java.util.List;

public record ProductResponse(
        String id,
        String title,
        String description,
        Double price,
        List<String> imageUrls,
        String category,
        ProductCondition condition,
        ProductStatus status,
        String sellerId,
        Instant createdAt,
        Instant updatedAt
) {
    public static ProductResponse fromEntity(Product product) {
        return new ProductResponse(
                product.getId(),
                product.getTitle(),
                product.getDescription(),
                product.getPrice(),
                product.getImageUrls(),
                product.getCategory(),
                product.getCondition(),
                product.getStatus(),
                product.getSellerId(),
                product.getCreatedAt(),
                product.getUpdatedAt()
        );
    }
}
