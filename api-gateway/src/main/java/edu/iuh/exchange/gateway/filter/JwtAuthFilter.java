package edu.iuh.exchange.gateway.filter;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

/**
 * JWT Auth Filter - Validate JWT Token tại API Gateway
 *
 * Quy trình:
 * 1. Lấy Bearer Token từ header Authorization
 * 2. Validate chữ ký + expiry của token
 * 3. Extract claims (userId, role, permissions)
 * 4. Gắn thông tin vào header để downstream service sử dụng
 * 5. Nếu token invalid → trả 401 Unauthorized ngay tại Gateway
 *
 * Downstream services KHÔNG cần validate JWT nữa, chỉ cần trust header từ Gateway.
 */
@Slf4j
@Component
public class JwtAuthFilter extends AbstractGatewayFilterFactory<JwtAuthFilter.Config> {

    @Value("${jwt.secret}")
    private String jwtSecret;

    public JwtAuthFilter() {
        super(Config.class);
    }

    @Override
    public GatewayFilter apply(Config config) {
        return (exchange, chain) -> {
            ServerHttpRequest request = exchange.getRequest();
            String authHeader = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);

            // Kiểm tra header tồn tại và đúng format "Bearer <token>"
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                log.warn("[JWT Filter] Missing or invalid Authorization header for path: {}",
                        request.getPath());
                return rejectUnauthorized(exchange, "Missing or invalid Authorization header");
            }

            String token = authHeader.substring(7);

            try {
                SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
                Claims claims = Jwts.parser()
                        .verifyWith(key)
                        .build()
                        .parseSignedClaims(token)
                        .getPayload();

                String userId   = claims.getSubject();
                String role     = claims.get("role", String.class);
                String email    = claims.get("email", String.class);

                log.debug("[JWT Filter] Authenticated user: {} with role: {}", userId, role);

                // Gắn thông tin user vào request header để downstream service nhận
                ServerHttpRequest mutatedRequest = request.mutate()
                        .header("X-User-Id", userId)
                        .header("X-User-Role", role)
                        .header("X-User-Email", email)
                        .build();

                return chain.filter(exchange.mutate().request(mutatedRequest).build());

            } catch (JwtException e) {
                log.warn("[JWT Filter] Invalid JWT token: {}", e.getMessage());
                return rejectUnauthorized(exchange, "Invalid or expired token");
            }
        };
    }

    /**
     * Trả về 401 Unauthorized dạng JSON chuẩn.
     */
    private Mono<Void> rejectUnauthorized(ServerWebExchange exchange, String message) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);

        String body = String.format(
            "{\"success\":false,\"statusCode\":401,\"message\":\"%s\",\"timestamp\":\"%s\"}",
            message, java.time.Instant.now()
        );

        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        org.springframework.core.io.buffer.DataBuffer buffer =
                response.bufferFactory().wrap(bytes);

        return response.writeWith(Mono.just(buffer));
    }

    public static class Config {
        // Có thể thêm config như list of excluded paths nếu cần
    }
}
