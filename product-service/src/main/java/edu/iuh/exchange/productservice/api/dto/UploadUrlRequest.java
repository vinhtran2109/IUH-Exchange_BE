package edu.iuh.exchange.productservice.api.dto;

public record UploadUrlRequest(
        String filename,
        String contentType
) {}
