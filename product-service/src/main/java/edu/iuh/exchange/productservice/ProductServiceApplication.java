package edu.iuh.exchange.productservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.data.mongodb.config.EnableMongoAuditing;

/**
 * Product Service - Product Management
 *
 * Phase 3 sẽ triển khai:
 * - CRUD Product với Pagination
 * - AWS S3 Presigned URL cho upload ảnh
 * - Kafka Producer: publish ProductCreatedEvent / ProductUpdatedEvent
 * - ElasticSearch Indexer Consumer
 * - FuzzySearch API
 * - Blacklist keyword filter
 *
 * Port: 8082
 */
@SpringBootApplication
@EnableDiscoveryClient
@EnableMongoAuditing
public class ProductServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(ProductServiceApplication.class, args);
    }
}
