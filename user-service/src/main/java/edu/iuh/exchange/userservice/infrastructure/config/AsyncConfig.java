package edu.iuh.exchange.userservice.infrastructure.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Enable Spring @Async cho EmailService.sendOtpEmail()
 * để gửi email không block request thread.
 */
@Configuration
@EnableAsync
public class AsyncConfig {
}
