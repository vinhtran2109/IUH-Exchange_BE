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
     * Bắt tin nhắn JSON thô từ Redis Pub/Sub và tự giải mã bằng ObjectMapper
     */
    public void onMessage(String json) {
        try {
            log.info("📢 [REDIS DEBUG] Đã bắt được tin nhắn thô: {}", json);
            
            // Tự giải mã bằng tay để kiểm soát lỗi
            ChatMessage chatMessage = objectMapper.readValue(json, ChatMessage.class);
            
            log.info("🚀 [REAL-TIME PUSH] Đẩy tin từ {} tới {}...", 
                     chatMessage.getSenderId(), chatMessage.getRecipientId());
            
            // Gửi qua WebSocket cho người nhận đích
            messagingTemplate.convertAndSendToUser(
                    chatMessage.getRecipientId(),
                    "/queue/messages",
                    chatMessage
            );
            log.info("✅ [FINISHED] Real-time Push thành công!");
        } catch (Exception e) {
            log.error("❌ [CRITICAL ERROR] Lỗi giải mã tin nhắn: {}", e.getMessage(), e);
        }
    }
}
