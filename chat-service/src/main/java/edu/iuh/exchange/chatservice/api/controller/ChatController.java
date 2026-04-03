package edu.iuh.exchange.chatservice.api.controller;

import edu.iuh.exchange.chatservice.config.RedisConfig;
import edu.iuh.exchange.chatservice.domain.model.ChatMessage;
import edu.iuh.exchange.chatservice.domain.repository.ChatMessageRepository;
import edu.iuh.exchange.common.dto.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@RestController
public class ChatController {

    private static final Logger log = LoggerFactory.getLogger(ChatController.class);
    private final ChatMessageRepository chatMessageRepository;
    private final RedisTemplate<String, Object> redisTemplate;

    public ChatController(ChatMessageRepository chatMessageRepository, RedisTemplate<String, Object> redisTemplate) {
        this.chatMessageRepository = chatMessageRepository;
        this.redisTemplate = redisTemplate;
    }

    /**
     * Client kết nối Websocket và gửi tin nhắn đến đích "/app/chat"
     */
    @MessageMapping("/chat")
    public void processMessage(@Payload ChatMessage chatMessage) {
        // Ghi nhận thời gian
        chatMessage.setTimestamp(Instant.now());
        
        // 1. Lưu vào Database (MongoDB)
        ChatMessage saved = chatMessageRepository.save(chatMessage);
        log.info("💾 [MongoDB] Saved message from {} to {}", saved.getSenderId(), saved.getRecipientId());

        // 2. Publish lên Redis Pub/Sub (Scale Out)
        // Tất cả các Server Chat Service đang chạy sẽ nghe thấy và thằng nào đang giữ
        // connection Websocket của "recipientId", nó sẽ bắn qua websocket cho thằng đó.
        redisTemplate.convertAndSend(RedisConfig.CHAT_TOPIC, saved);
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
