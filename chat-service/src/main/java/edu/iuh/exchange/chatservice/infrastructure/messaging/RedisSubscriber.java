package edu.iuh.exchange.chatservice.infrastructure.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import edu.iuh.exchange.chatservice.domain.model.ChatMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Service;

@Service
public class RedisSubscriber {

    private static final Logger log = LoggerFactory.getLogger(RedisSubscriber.class);
    private final ObjectMapper objectMapper;
    private final SimpMessageSendingOperations messagingTemplate;

    public RedisSubscriber(ObjectMapper objectMapper, SimpMessageSendingOperations messagingTemplate) {
        this.objectMapper = objectMapper;
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Bắt tin nhắn từ Redis Pub/Sub và đẩy qua Websocket cho người nhận
     */
    public void onMessage(String message) {
        try {
            // Lấy JSON parse lại thành ChatMessage
            String unescaped = message.startsWith("\"") ? objectMapper.readValue(message, String.class) : message;
            ChatMessage chatMessage = objectMapper.readValue(unescaped, ChatMessage.class);
            
            // Gửi qua WebSocket cho người nhận đích (Sẽ được định tuyến tới queue của user)
            log.info("🚀 [WebSocket] Pushing message from {} to {}", chatMessage.getSenderId(), chatMessage.getRecipientId());
            messagingTemplate.convertAndSendToUser(
                    chatMessage.getRecipientId(),
                    "/queue/messages",
                    chatMessage
            );
        } catch (Exception e) {
            log.error("❌ [RedisSubscriber] Lỗi parse tin nhắn: {}", e.getMessage());
        }
    }
}
