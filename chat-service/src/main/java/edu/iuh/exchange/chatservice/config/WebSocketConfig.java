package edu.iuh.exchange.chatservice.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Nơi server gửi tin nhắn xuống cho Client
        config.enableSimpleBroker("/topic", "/queue", "/user");
        // Nơi Client đẩy tin nhắn lên cho Server (@MessageMapping)
        config.setApplicationDestinationPrefixes("/app");
        // Giúp server biết đích danh từng user khi gửi tin cá nhân
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Điểm kết nối đầu tiên của Frontend (Handshake)
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*") // Mở CORS cho Frontend
                .withSockJS(); // Cung cấp fallback cho browser cũ
    }
}
