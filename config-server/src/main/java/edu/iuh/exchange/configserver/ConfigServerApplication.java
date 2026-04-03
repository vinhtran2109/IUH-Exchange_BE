package edu.iuh.exchange.configserver;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.config.server.EnableConfigServer;

/**
 * Config Server - Centralized Configuration Management
 *
 * Tất cả các microservice sẽ pull config từ đây khi khởi động.
 * URL: http://localhost:8888/{service-name}/{profile}
 *
 * Ví dụ:
 *   http://localhost:8888/api-gateway/default
 *   http://localhost:8888/user-service/production
 */
@SpringBootApplication
@EnableConfigServer
public class ConfigServerApplication {

    public static void main(String[] args) {
        SpringApplication.run(ConfigServerApplication.class, args);
    }
}
