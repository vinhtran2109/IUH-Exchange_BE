package edu.iuh.exchange.registry;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.netflix.eureka.server.EnableEurekaServer;

/**
 * Service Registry - Eureka Discovery Server
 *
 * Tất cả các microservice đăng ký vào đây.
 * Dashboard: http://localhost:8761
 *
 * Danh sách services đăng ký:
 * - api-gateway       (8080)
 * - user-service      (8081)
 * - product-service   (8082)
 * - order-service     (8083)
 * - notification-svc  (8084)
 * - chat-service      (8085)
 * - lost-found-svc    (8086)
 */
@SpringBootApplication
@EnableEurekaServer
public class ServiceRegistryApplication {

    public static void main(String[] args) {
        SpringApplication.run(ServiceRegistryApplication.class, args);
    }
}
