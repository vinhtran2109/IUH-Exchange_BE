package edu.iuh.exchange.gateway.filter;

import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.core.Ordered;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.time.Instant;

/**
 * Global Logging Filter - Request/Response logging cho tất cả routes.
 *
 * Log format:
 * [GATEWAY] --> GET /api/v1/products?page=1 | IP: 192.168.1.1 | User: user-123
 * [GATEWAY] <-- 200 | 45ms | /api/v1/products
 */
@Slf4j
@Component
public class LoggingFilter implements GlobalFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        long startTime = Instant.now().toEpochMilli();

        String method = request.getMethod().name();
        String path   = request.getURI().getPath();
        String query  = request.getURI().getQuery();
        String ip     = request.getRemoteAddress() != null
                ? request.getRemoteAddress().getAddress().getHostAddress()
                : "unknown";
        String userId = request.getHeaders().getFirst("X-User-Id");

        log.info("[GATEWAY] --> {} {}{}  | IP: {} | User: {}",
                method, path,
                query != null ? "?" + query : "",
                ip,
                userId != null ? userId : "anonymous");

        return chain.filter(exchange).then(Mono.fromRunnable(() -> {
            long elapsed = Instant.now().toEpochMilli() - startTime;
            int status   = exchange.getResponse().getStatusCode() != null
                    ? exchange.getResponse().getStatusCode().value()
                    : 0;

            log.info("[GATEWAY] <-- {} | {}ms | {}", status, elapsed, path);
        }));
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE - 1;
    }
}
