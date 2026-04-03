package edu.iuh.exchange.userservice.api.controller;

import edu.iuh.exchange.common.dto.ApiResponse;
import edu.iuh.exchange.userservice.api.dto.UserProfileResponse;
import edu.iuh.exchange.userservice.application.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
}
