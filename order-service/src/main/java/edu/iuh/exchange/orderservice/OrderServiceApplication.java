package edu.iuh.exchange.orderservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.data.mongodb.config.EnableMongoAuditing;

/**
 * Order Service - Quản lý đơn hàng
 *
 * Phase 4 sẽ triển khai:
 * - Create Order với Idempotency-Key
 * - Saga Choreography Pattern (OrderCreatedEvent)
 * - Compensating Transaction (Rollback khi lỗi)
 * - KarmaPoint cộng/trừ
 *
 * Port: 8083
 */
@SpringBootApplication
@EnableDiscoveryClient
@EnableMongoAuditing
public class OrderServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(OrderServiceApplication.class, args);
    }
}
