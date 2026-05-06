package edu.iuh.exchange.chatservice.domain.model;

import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "chat_messages")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessage {

    @Id
    private String id;
    
    private String senderId;
    private String recipientId;
    private String content;

    @Builder.Default
    private boolean isRead = false;

    @CreatedDate
    private Instant timestamp;
}
