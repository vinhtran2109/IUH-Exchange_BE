package edu.iuh.exchange.productservice.api.dto;

import edu.iuh.exchange.productservice.domain.model.ProductStatus;

public record ProductEvent(
        String id,
        String title,
        String description,
        Double price,
        String category,
        ProductStatus status
) {}
