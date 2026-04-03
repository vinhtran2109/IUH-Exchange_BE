package edu.iuh.exchange.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * API Gateway - Single Entry Point cho toàn bộ hệ thống
 *
 * Chức năng:
 * - Routing request đến đúng microservice
 * - JWT Auth Filter (validate token trước khi pass xuống service)
 * - Rate Limiting với Redis (chống DDoS, brute-force)
 * - Circuit Breaker (Resilience4j)
 * - Request/Response Logging
 *
 * Port: 8080
 */
@SpringBootApplication
@EnableDiscoveryClient
public class ApiGatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(ApiGatewayApplication.class, args);
    }
}
