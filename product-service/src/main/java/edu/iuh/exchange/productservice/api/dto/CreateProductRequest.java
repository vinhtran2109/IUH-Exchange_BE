package edu.iuh.exchange.productservice.api.dto;

import edu.iuh.exchange.productservice.domain.model.ProductCondition;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateProductRequest(
        @NotBlank(message = "Title is required")
        @Size(min = 10, max = 200, message = "Title must be between 10 and 200 characters")
        String title,

        @NotBlank(message = "Description is required")
        @Size(min = 20, max = 2000, message = "Description must be between 20 and 2000 characters")
        String description,

        @NotNull(message = "Price is required")
        @Min(value = 0, message = "Price cannot be negative")
        Double price,

        @NotNull(message = "Category is required")
        String category,

        @NotNull(message = "Condition is required")
        ProductCondition condition,

        @Size(max = 5, message = "Maximum 5 images allowed")
        List<String> imageUrls
) {}
