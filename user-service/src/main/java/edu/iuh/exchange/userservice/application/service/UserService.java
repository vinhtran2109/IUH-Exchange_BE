package edu.iuh.exchange.userservice.application.service;

import edu.iuh.exchange.common.exception.ResourceNotFoundException;
import edu.iuh.exchange.userservice.api.dto.UserProfileResponse;
import edu.iuh.exchange.userservice.domain.model.User;
import edu.iuh.exchange.userservice.domain.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * User Service - CRUD thông tin người dùng
 */
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public UserProfileResponse getProfile(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        return mapToProfile(user);
    }

    public UserProfileResponse getMyProfile(String userIdFromHeader) {
        return getProfile(userIdFromHeader);
    }

    /**
     * Hạ KarmaPoint (được gọi khi user vi phạm)
     * Nếu karmaPoint < 0 → tự động thu hồi CAN_POST permission
     */
    public void decreaseKarmaPoint(String userId, int amount) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        int newKarma = user.getKarmaPoint() - amount;
        user.setKarmaPoint(newKarma);

        if (newKarma < 0) {
            // Thu hồi quyền đăng bài
            user.getPermissions().remove(User.Permission.CAN_POST);
        }

        userRepository.save(user);
    }

    /**
     * Cộng KarmaPoint (sau giao dịch thành công)
     */
    public void increaseKarmaPoint(String userId, int amount) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        user.setKarmaPoint(user.getKarmaPoint() + amount);

        // Nếu karma đã về dương, khôi phục CAN_POST
        if (user.getKarmaPoint() >= 0 && !user.getPermissions().contains(User.Permission.CAN_POST)) {
            user.getPermissions().add(User.Permission.CAN_POST);
        }

        userRepository.save(user);
    }

    private UserProfileResponse mapToProfile(User user) {
        return UserProfileResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .name(user.getName())
                .studentId(user.getStudentId())
                .avatarUrl(user.getAvatarUrl())
                .isVerified(user.isVerified())
                .karmaPoint(user.getKarmaPoint())
                .role(user.getRole().name())
                .permissions(user.getPermissions())
                .build();
    }
}
