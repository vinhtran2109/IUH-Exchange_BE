package edu.iuh.exchange.notificationservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * Notification Service - Thông báo người dùng
 *
 * Phase 5 sẽ triển khai:
 * - Kafka Consumer: lắng nghe events từ các service khác
 * - WebSocket STOMP: push thông báo real-time
 * - Lưu notification history vào MongoDB
 * - Email Notification (OTP, hóa đơn)
 *
 * Port: 8084
 */
@SpringBootApplication
@EnableDiscoveryClient
public class NotificationServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(NotificationServiceApplication.class, args);
    }
}
