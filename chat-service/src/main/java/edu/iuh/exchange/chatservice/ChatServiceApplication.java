package edu.iuh.exchange.chatservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * Chat Service - Real-time Messaging
 *
 * Phase 5 sẽ triển khai:
 * - WebSocket STOMP cho chat trực tiếp 1-1
 * - Redis Pub/Sub để scale ra nhiều instance
 * - Lưu message history vào MongoDB
 * - Blacklist keyword filter cho chat messages
 *
 * Port: 8085
 */
@SpringBootApplication
@EnableDiscoveryClient
public class ChatServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(ChatServiceApplication.class, args);
    }
}
