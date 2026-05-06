package edu.iuh.exchange.productservice.api.dto;

import edu.iuh.exchange.productservice.domain.model.ProductStatus;
import java.util.List;

/**
 * Event message gửi sang Kafka khi có sản phẩm mới
 */
public record ProductEvent(
        String id,
        String title,
        String description,
        Double price,
        String category,
        List<String> imageUrls,
        ProductStatus status
) {}
