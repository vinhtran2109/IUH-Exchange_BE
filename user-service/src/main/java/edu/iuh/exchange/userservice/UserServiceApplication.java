package edu.iuh.exchange.userservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.data.mongodb.config.EnableMongoAuditing;

/**
 * User Service - Authentication & User Management
 *
 * Phase 2 sẽ triển khai:
 * - API Đăng ký + Validate @student.iuh.edu.vn
 * - OTP Email verification
 * - JWT Login / Refresh Token
 * - RBAC (Role-Based Access Control)
 *
 * Port: 8081
 */
@SpringBootApplication
@EnableDiscoveryClient
@EnableMongoAuditing
public class UserServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(UserServiceApplication.class, args);
    }
}
