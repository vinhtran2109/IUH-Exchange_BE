package edu.iuh.exchange.userservice.application.service;

import edu.iuh.exchange.common.exception.ResourceNotFoundException;
import edu.iuh.exchange.userservice.api.dto.UserProfileResponse;
import edu.iuh.exchange.userservice.domain.model.User;
import edu.iuh.exchange.userservice.domain.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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
     * [ADMIN] Lấy danh sách tất cả users (phân trang)
     */
    public Page<UserProfileResponse> getAllUsers(int page, int size) {
        Page<User> users = userRepository.findAll(
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        );
        return users.map(this::mapToProfile);
    }

    /**
     * [ADMIN] Ban hoặc Unban user
     */
    public UserProfileResponse toggleBanUser(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        user.setActive(!user.isActive());

        if (!user.isActive()) {
            // Khi ban: thu hồi hết quyền
            user.getPermissions().clear();
        } else {
            // Khi unban: khôi phục quyền mặc định
            user.setPermissions(java.util.List.of(
                    User.Permission.CAN_POST,
                    User.Permission.CAN_CHAT,
                    User.Permission.CAN_REPORT
            ));
        }

        User saved = userRepository.save(user);
        return mapToProfile(saved);
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

    public UserProfileResponse updateProfile(String userId, String name, String avatarUrl) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        
        if (name != null) user.setName(name);
        if (avatarUrl != null) user.setAvatarUrl(avatarUrl);
        
        User saved = userRepository.save(user);
        return mapToProfile(saved);
    }

    /**
     * [ADMIN] Thống kê user
     */
    public java.util.Map<String, Object> getUserStats() {
        return java.util.Map.of(
            "total", userRepository.count(),
            "active", userRepository.findAll().stream().filter(u -> u.isActive()).count(), // Đơn giản hóa, thực tế nên dùng query
            "banned", userRepository.findAll().stream().filter(u -> !u.isActive()).count(),
            "lowKarma", userRepository.findAll().stream().filter(u -> u.getKarmaPoint() < 0).count()
        );
    }


    private UserProfileResponse mapToProfile(User user) {
        return UserProfileResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .name(user.getName())
                .studentId(user.getStudentId())
                .avatarUrl(user.getAvatarUrl())
                .isVerified(user.isVerified())
                .isActive(user.isActive())
                .karmaPoint(user.getKarmaPoint())
                .role(user.getRole().name())
                .permissions(user.getPermissions())
                .build();
    }
}

