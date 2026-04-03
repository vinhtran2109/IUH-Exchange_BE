package edu.iuh.exchange.lostfoundservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.data.mongodb.config.EnableMongoAuditing;

/**
 * Lost & Found Service - Đồ thất lạc
 *
 * Phase 6 sẽ triển khai:
 * - API đăng ký đồ thất lạc
 * - Report Module (tố cáo user/sản phẩm)
 * - Moderation + KarmaPoint system
 *
 * Port: 8086
 */
@SpringBootApplication
@EnableDiscoveryClient
@EnableMongoAuditing
public class LostFoundServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(LostFoundServiceApplication.class, args);
    }
}
