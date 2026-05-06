package edu.iuh.exchange.chatservice.api.controller;

import edu.iuh.exchange.chatservice.config.RedisConfig;
import edu.iuh.exchange.chatservice.domain.model.ChatMessage;
import edu.iuh.exchange.chatservice.domain.repository.ChatMessageRepository;
import edu.iuh.exchange.common.dto.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.web.bind.annotation.RestController;
import jakarta.annotation.PostConstruct;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.time.Instant;
import java.util.List;

@RestController
public class ChatController {

    private static final Logger log = LoggerFactory.getLogger(ChatController.class);
    private final ChatMessageRepository chatMessageRepository;
    private final RedisTemplate<String, Object> redisTemplate;
    private final SimpMessageSendingOperations messagingTemplate;

    @PostConstruct
    public void init() {
        log.info("💎 [ChatController] BỘ PHẬN XỬ LÝ CHAT ĐÃ SẴN SÀNG! 🚀");
    }

    public ChatController(ChatMessageRepository chatMessageRepository, 
                          RedisTemplate<String, Object> redisTemplate,
                          SimpMessageSendingOperations messagingTemplate) {
        this.chatMessageRepository = chatMessageRepository;
        this.redisTemplate = redisTemplate;
        this.messagingTemplate = messagingTemplate;
    }


    /**
     * Client kết nối Websocket và gửi tin nhắn đến đích "/app/chat"
     */
    @MessageMapping("/chat")
    public void processMessage(@Payload ChatMessage chatMessage) {
        log.info("📩 [WebSocket] Received raw message: FROM {} TO {}", 
                 chatMessage.getSenderId(), chatMessage.getRecipientId());
        
        try {
            // Ghi nhận thời gian
            chatMessage.setTimestamp(Instant.now());
            
            // 1. Lưu vào Database (MongoDB)
            ChatMessage saved = chatMessageRepository.save(chatMessage);
            log.info("💾 [MongoDB] Successfully saved message ID: {}", saved.getId());

            // 2. Publish lên Redis Pub/Sub (Scale Out)
            redisTemplate.convertAndSend(RedisConfig.CHAT_TOPIC, saved);
            log.info("📡 [Redis] Published message to topic: {}", RedisConfig.CHAT_TOPIC);

            // 3. [DEBUG] Broadcast trực tiếp tới WebSocket (Bỏ qua Redis cho phép thử)
            messagingTemplate.convertAndSend("/topic/public", saved);
            messagingTemplate.convertAndSendToUser(saved.getRecipientId(), "/queue/messages", saved);
            log.info("⚡ [DEBUG] Direct Push completed to recipient: {}", saved.getRecipientId());
        } catch (Exception e) {


            log.error("❌ [ChatController] FATAL ERROR processing message: {}", e.getMessage(), e);
        }
    }


    /**
     * Lấy danh sách các User đã từng nhắn tin với userId (Hộp thư Inbox)
     */
    @GetMapping("/api/v1/chat/conversations/{userId}")
    public ResponseEntity<ApiResponse<List<String>>> getConversations(@PathVariable String userId) {
        // Tìm tất cả tin nhắn liên quan đến user này
        List<ChatMessage> messages = chatMessageRepository.findBySenderIdOrRecipientIdOrderByTimestampDesc(userId, userId);
        
        // Lấy danh sách ID đối tác (người còn lại trong cuộc hội thoại) duy nhất và giữ thứ tự mới nhất
        List<String> partners = messages.stream()
                .map(m -> m.getSenderId().equals(userId) ? m.getRecipientId() : m.getSenderId())
                .distinct()
                .toList();
                
        return ResponseEntity.ok(ApiResponse.ok(partners));
    }

    /**
     * API tĩnh lấy lịch sử tin nhắn giữa 2 người
     */

    @GetMapping("/api/v1/chat/history/{senderId}/{recipientId}")
    public ResponseEntity<ApiResponse<List<ChatMessage>>> getChatHistory(


            @PathVariable String senderId,
            @PathVariable String recipientId) {
        
        List<ChatMessage> history = chatMessageRepository
                .findBySenderIdAndRecipientIdOrSenderIdAndRecipientIdOrderByTimestampAsc(
                        senderId, recipientId, recipientId, senderId
                );
                
        return ResponseEntity.ok(ApiResponse.ok(history));
    }
}
