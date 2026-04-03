package edu.iuh.exchange.chatservice.domain.repository;

import edu.iuh.exchange.chatservice.domain.model.ChatMessage;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends MongoRepository<ChatMessage, String> {
    
    // Lấy lịch sử chat giữa 2 người
    List<ChatMessage> findBySenderIdAndRecipientIdOrSenderIdAndRecipientIdOrderByTimestampAsc(
            String sender1, String recipient1, String sender2, String recipient2
    );
}
