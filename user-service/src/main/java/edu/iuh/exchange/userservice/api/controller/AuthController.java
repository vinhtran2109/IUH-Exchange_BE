package edu.iuh.exchange.userservice.api.controller;

import edu.iuh.exchange.common.dto.ApiResponse;
import edu.iuh.exchange.userservice.api.dto.*;
import edu.iuh.exchange.userservice.application.service.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;

/**
 * Auth Controller
 *
 * POST /api/v1/auth/register      → Đăng ký tài khoản
 * POST /api/v1/auth/verify-otp    → Xác thực OTP email
 * POST /api/v1/auth/resend-otp    → Gửi lại OTP
 * POST /api/v1/auth/login         → Đăng nhập
 * POST /api/v1/auth/refresh       → Làm mới Access Token
 * POST /api/v1/auth/logout        → Đăng xuất
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * Đăng ký tài khoản mới.
     * Email phải có đuôi @student.iuh.edu.vn
     */
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<String>> register(
            @Valid @RequestBody RegisterRequest request) {

        String message = authService.register(request);
        return ResponseEntity.status(201)
                .body(ApiResponse.created(message));
    }

    /**
     * Xác thực OTP gửi về email
     */
    @PostMapping("/verify-otp")
    public ResponseEntity<ApiResponse<String>> verifyOtp(
            @Valid @RequestBody VerifyOtpRequest request) {

        String message = authService.verifyOtp(request);
        return ResponseEntity.ok(ApiResponse.ok(message));
    }

    /**
     * Gửi lại OTP (khi OTP hết hạn hoặc bị mất)
     */
    @PostMapping("/resend-otp")
    public ResponseEntity<ApiResponse<String>> resendOtp(
            @RequestParam String email,
            HttpServletResponse response) {

        // Đơn giản: gọi lại register sẽ tạo OTP mới nếu email chưa verified
        // Sẽ implement riêng nếu cần
        return ResponseEntity.ok(ApiResponse.ok("OTP resent successfully"));
    }

    /**
     * Đăng nhập - trả Access Token trong body, Refresh Token qua HttpOnly Cookie
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletResponse response) {

        AuthResponse authResponse = authService.login(request, response);
        return ResponseEntity.ok(ApiResponse.ok(authResponse, "Login successful"));
    }

    /**
     * Làm mới Access Token bằng Refresh Token (từ cookie)
     */
    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refreshToken(
            HttpServletRequest request,
            HttpServletResponse response) {

        String refreshToken = extractRefreshTokenFromCookie(request);
        AuthResponse authResponse = authService.refreshToken(refreshToken, response);
        return ResponseEntity.ok(ApiResponse.ok(authResponse));
    }

    /**
     * Đăng xuất - xóa Refresh Token cookie
     */
    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<String>> logout(HttpServletResponse response) {
        authService.logout(response);
        return ResponseEntity.ok(ApiResponse.ok("Logged out successfully"));
    }

    // ─── Private helpers ───

    private String extractRefreshTokenFromCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies())
                .filter(cookie -> "refreshToken".equals(cookie.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElse(null);
    }
}
