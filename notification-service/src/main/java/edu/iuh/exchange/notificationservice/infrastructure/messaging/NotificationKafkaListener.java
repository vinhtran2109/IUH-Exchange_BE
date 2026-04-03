package edu.iuh.exchange.notificationservice.infrastructure.messaging;

import edu.iuh.exchange.notificationservice.domain.model.Notification;
import edu.iuh.exchange.notificationservice.domain.repository.NotificationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class NotificationKafkaListener {

    private static final Logger log = LoggerFactory.getLogger(NotificationKafkaListener.class);
    private final NotificationRepository notificationRepository;
    private final SimpMessageSendingOperations messagingTemplate;

    public NotificationKafkaListener(NotificationRepository notificationRepository, SimpMessageSendingOperations messagingTemplate) {
        this.notificationRepository = notificationRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @KafkaListener(topics = "order.created", groupId = "notification-service-group")
    public void onOrderCreated(Map<String, Object> payload) {
        String sellerId = (String) payload.get("sellerId");
        String orderId = (String) payload.get("orderId");
        
        sendNotification(sellerId, "Đơn hàng mới", "Bạn có một yêu cầu mua sách mới từ đơn hàng " + orderId, "ORDER");
    }

    @KafkaListener(topics = "order.completed", groupId = "notification-service-group")
    public void onOrderCompleted(Map<String, Object> payload) {
        String buyerId = (String) payload.get("buyerId");
        String sellerId = (String) payload.get("sellerId");
        String orderId = (String) payload.get("orderId");
        
        sendNotification(buyerId, "Giao dịch thành công", "Đơn hàng " + orderId + " đã được chốt!", "ORDER");
        sendNotification(sellerId, "Giao dịch thành công", "Đơn hàng " + orderId + " đã được chốt!", "ORDER");
    }

    @KafkaListener(topics = "order.cancelled", groupId = "notification-service-group")
    public void onOrderCancelled(Map<String, Object> payload) {
        // Thông báo này thường dành cho Buyer
        String orderId = (String) payload.get("orderId");
        String reason = (String) payload.get("reason");
        // Giả sử lấy được buyerId từ payload, nhưng hiện tại payload chỉ có orderId và reason.
        // Tạm thời nếu payload chưa có buyerId thì chỉ log. Trong thực tế cần bổ sung buyerId vào event.
        log.warn("🔔 [Notify] Order {} cancelled: {}", orderId, reason);
    }

    private void sendNotification(String recipientId, String title, String message, String type) {
        if (recipientId == null) return;
        
        Notification notification = Notification.builder()
                .recipientId(recipientId)
                .title(title)
                .message(message)
                .type(type)
                .build();
                
        Notification saved = notificationRepository.save(notification);
        log.info("🔔 [Notify] Đã lưu thông báo cho {}: {}", recipientId, message);
        
        // Đẩy thẳng qua Websocket cho Client
        messagingTemplate.convertAndSendToUser(
                recipientId,
                "/queue/notifications",
                saved
        );
    }
}
