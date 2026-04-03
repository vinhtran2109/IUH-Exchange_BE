package edu.iuh.exchange.userservice.infrastructure.messaging;

import edu.iuh.exchange.userservice.domain.model.User;
import edu.iuh.exchange.userservice.domain.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class KarmaPointListener {

    private static final Logger log = LoggerFactory.getLogger(KarmaPointListener.class);
    private final UserRepository userRepository;

    public KarmaPointListener(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @KafkaListener(topics = "order.completed", groupId = "user-service-karma-group")
    public void onOrderCompleted(Map<String, Object> payload) {
        String buyerId = (String) payload.get("buyerId");
        String sellerId = (String) payload.get("sellerId");
        
        log.info("🎉 [KARMA] Order Completed between buyer {} and seller {}. Adding Karma Points!", buyerId, sellerId);
        
        addKarmaPoint(buyerId, 1);
        addKarmaPoint(sellerId, 1);
    }

    @KafkaListener(topics = "order.cancelled", groupId = "user-service-karma-group")
    public void onOrderCancelled(Map<String, Object> payload) {
        // Trong tương lai nếu có lý do Buyer bùng hàng, sẽ trừ điểm Buyer
        // Hiện tại tạm thời log ra
        String orderId = (String) payload.get("orderId");
        String reason = (String) payload.get("reason");
        log.warn("📉 [KARMA] Order {} cancelled. Reason: {}", orderId, reason);
    }

    private void addKarmaPoint(String studentId, int points) {
        userRepository.findByStudentId(studentId).ifPresentOrElse(user -> {
            user.setKarmaPoint(user.getKarmaPoint() + points);
            userRepository.save(user);
            log.info("⭐ [KARMA] Tặng {} Karma Point cho sinh viên {}. Tổng điểm hiện tại: {}", 
                     points, studentId, user.getKarmaPoint());
        }, () -> {
            log.warn("⚠️ [KARMA] Sinh viên {} không tồn tại trong hệ thống (Tạo bằng Postman ảo?)", studentId);
        });
    }
}
