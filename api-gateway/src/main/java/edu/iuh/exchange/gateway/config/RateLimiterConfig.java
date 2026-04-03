package edu.iuh.exchange.gateway.config;

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import reactor.core.publisher.Mono;

/**
 * Rate Limiter Key Resolvers cho từng loại endpoint.
 *
 * - ipKeyResolver: Dùng IP để rate limit (cho Auth endpoints public)
 * - userKeyResolver: Dùng userId từ JWT header (cho authenticated endpoints)
 */
@Configuration
public class RateLimiterConfig {

    /**
     * Rate limit dựa theo IP.
     * Dùng cho: /api/v1/auth/** (đăng ký, đăng nhập)
     */
    @Bean
    @org.springframework.context.annotation.Primary
    public KeyResolver ipKeyResolver() {
        return exchange -> {
            var remoteAddress = exchange.getRequest().getRemoteAddress();
            String ip = remoteAddress != null
                    ? remoteAddress.getAddress().getHostAddress()
                    : "unknown";
            return Mono.just(ip);
        };
    }

    /**
     * Rate limit dựa theo User ID (lấy từ X-User-Id header do JwtAuthFilter gán).
     * Dùng cho: Authenticated endpoints
     */
    @Bean
    public KeyResolver userKeyResolver() {
        return exchange -> {
            String userId = exchange.getRequest().getHeaders().getFirst("X-User-Id");
            return Mono.just(userId != null ? userId : "anonymous");
        };
    }
}
