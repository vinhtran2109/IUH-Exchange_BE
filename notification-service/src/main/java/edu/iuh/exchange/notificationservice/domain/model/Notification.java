package edu.iuh.exchange.notificationservice.domain.model;

import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "notifications")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Notification {

    @Id
    private String id;
    
    private String recipientId; // Người nhận
    private String title;
    private String message;
    private String type; // ORDER, CHAT, SYSTEM, REPORT
    
    @Builder.Default
    private boolean read = false;
    
    @CreatedDate
    private Instant createdAt;
}
