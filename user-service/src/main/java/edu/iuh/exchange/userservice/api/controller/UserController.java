package edu.iuh.exchange.userservice.api.controller;

import edu.iuh.exchange.common.dto.ApiResponse;
import edu.iuh.exchange.userservice.api.dto.UserProfileResponse;
import edu.iuh.exchange.userservice.application.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * User Controller

 *
 * GET  /api/v1/users/me           → Lấy thông tin bản thân (từ JWT header)
 * GET  /api/v1/users/{id}         → Lấy thông tin user theo ID
 */
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final edu.iuh.exchange.userservice.application.service.AuthService authService;
    private final edu.iuh.exchange.userservice.infrastructure.s3.S3Service s3Service;

    /**
     * Upload ảnh lên S3 cho Avatar và trả về URL
     */
    @PostMapping("/avatar")
    public ResponseEntity<ApiResponse<String>> uploadAvatar(
            @RequestParam("file") MultipartFile file) {
        
        String url = s3Service.uploadAvatar(file);
        return ResponseEntity.ok(ApiResponse.ok(url, "Tải ảnh lên S3 thành công!"));
    }

    /**
     * Lấy profile của chính mình.
     * X-User-Id được inject bởi API Gateway JwtAuthFilter.
     */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserProfileResponse>> getMyProfile(
            @RequestHeader("X-User-Id") String userId) {

        UserProfileResponse profile = userService.getMyProfile(userId);
        return ResponseEntity.ok(ApiResponse.ok(profile));
    }

    /**
     * Lấy profile của user khác (public - chưa cần auth)
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<UserProfileResponse>> getUserProfile(
            @PathVariable String id) {

        UserProfileResponse profile = userService.getProfile(id);
        return ResponseEntity.ok(ApiResponse.ok(profile));
    }

    /**
     * Cập nhật profile của chính mình.
     */
    @PatchMapping("/me")
    public ResponseEntity<ApiResponse<UserProfileResponse>> updateMyProfile(
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestBody java.util.Map<String, String> body) {
        
        // Ưu tiên lấy ID từ Gateway header (an toàn hơn), nếu không có thì báo lỗi
        if (headerUserId == null || headerUserId.isEmpty()) {
            return ResponseEntity.status(401).body(ApiResponse.error(401, "Thiếu danh tính người dùng (X-User-Id)"));
        }


        String name = body.get("name");
        String avatarUrl = body.get("avatarUrl");
        
        UserProfileResponse updated = userService.updateProfile(headerUserId, name, avatarUrl);
        return ResponseEntity.ok(ApiResponse.ok(updated, "Cập nhật hồ sơ thành công!"));
    }

    /**
     * Đổi mật khẩu mới.
     * Endpoint: POST /api/v1/users/password
     */
    @PostMapping("/password")
    public ResponseEntity<ApiResponse<String>> changePassword(
            @RequestHeader("X-User-Id") String userId,
            @RequestBody java.util.Map<String, String> body) {
        
        String oldPassword = body.get("oldPassword");
        String newPassword = body.get("newPassword");
        
        String message = authService.changePassword(userId, oldPassword, newPassword);
        return ResponseEntity.ok(ApiResponse.ok(message));
    }

    // ==========================================
    // ADMIN ENDPOINTS
    // ==========================================

    /**
     * [ADMIN] Xem danh sách toàn bộ người dùng
     */
    @GetMapping("/admin/all")
    public ResponseEntity<ApiResponse<org.springframework.data.domain.Page<UserProfileResponse>>> getAllUsers(
            @RequestHeader("X-User-Role") String role,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        return ResponseEntity.ok(ApiResponse.ok(userService.getAllUsers(page, size)));
    }

    /**
     * [ADMIN] Khóa hoặc mở khóa người dùng
     */
    @PatchMapping("/admin/{id}/toggle-ban")
    public ResponseEntity<ApiResponse<UserProfileResponse>> toggleBanUser(
            @RequestHeader("X-User-Role") String role,
            @PathVariable String id) {
        
        return ResponseEntity.ok(ApiResponse.ok(userService.toggleBanUser(id)));
    }

    /**
     * [ADMIN] Thống kê User Dashboard
     */
    @GetMapping("/admin/stats")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getUserStats(
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        
        if (role == null || !"ADMIN".equals(role)) {
            return ResponseEntity.status(403).body(ApiResponse.error(403, "Quyền Admin là bắt buộc để xem thống kê. Vai trò hiện tại: " + role));
        }
        
        return ResponseEntity.ok(ApiResponse.ok(userService.getUserStats()));
    }
}

