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
 * [DEBUG-READY] JWT Auth Safe Filter
 * Đảm bảo header X-User-Role được truyền chuẩn xác xuống backend.
 */
@Slf4j
@Component
public class JwtAuthSafeGatewayFilterFactory extends AbstractGatewayFilterFactory<JwtAuthSafeGatewayFilterFactory.Config> {

    @Value("${jwt.secret:iuh_campus_exchange_secret_key_2024_secure_safe_fixed}")
    private String jwtSecret;

    public JwtAuthSafeGatewayFilterFactory() {
        super(Config.class);
    }

    @Override
    public GatewayFilter apply(Config config) {
        return (exchange, chain) -> {
            ServerHttpRequest request = exchange.getRequest();
            String path = request.getPath().toString();
            String method = request.getMethod().name();

            // 🔍 LOG BẮT ĐẦU: Nếu dòng này không hiện ra -> Code cũ đang chạy!
            log.info("🎯 [GATEWAY-FORCE] Processing {} : {}", method, path);

            // 1. Skip paths (OPTIONS & public GETs only)
            if (method.equalsIgnoreCase("OPTIONS") || 
               (method.equalsIgnoreCase("GET") && !path.contains("/admin/") && 
               ((path.startsWith("/api/v1/products") && !path.startsWith("/api/v1/products/me")) || 
                (path.startsWith("/api/v1/users") && !path.startsWith("/api/v1/users/me")) || 
                path.startsWith("/ws") || 
                path.startsWith("/api/v1/chat") || 
                path.startsWith("/api/v1/lost-found")))) {
                return chain.filter(exchange);
            }

            // 2. Auth Header Check
            String authHeader = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                log.warn("⚠️ [GATEWAY-FORCE] Anonymous Access attempted for protected path: {}", path);
                return chain.filter(exchange); // Cho đi tiếp nếu backend đã set required=false
            }

            String token = authHeader.substring(7);

            try {
                // 3. Decode & Inject Headers
                SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
                Claims claims = Jwts.parser()
                        .verifyWith(key)
                        .build()
                        .parseSignedClaims(token)
                        .getPayload();

                String userId = claims.getSubject();
                String role = (String) claims.get("role");
                String email = (String) claims.get("email");

                if (role == null) role = "GUEST";
                
                log.info("🔑 [GATEWAY-FORCE] JWT Decoded -> User: {}, Role: {}, Path: {}", userId, role, path);

                // Quan trọng: Ghi đè request với các Header mới
                ServerHttpRequest mutatedRequest = request.mutate()
                        .header("X-User-Id", userId != null ? userId : "")
                        .header("X-User-Role", role)
                        .header("X-User-Email", email != null ? email : "")
                        .build();

                return chain.filter(exchange.mutate().request(mutatedRequest).build());

            } catch (JwtException e) {
                log.error("🔥 [GATEWAY-FORCE] JWT Extraction Failed: {}", e.getMessage());
                return reject(exchange, "Authentication failed: " + e.getMessage(), HttpStatus.UNAUTHORIZED);
            }
        };
    }

    private Mono<Void> reject(ServerWebExchange exchange, String message, HttpStatus status) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(status);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        String body = String.format("{\"success\":false,\"message\":\"%s\"}", message);
        return response.writeWith(Mono.just(response.bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8))));
    }

    public static class Config {}
}
