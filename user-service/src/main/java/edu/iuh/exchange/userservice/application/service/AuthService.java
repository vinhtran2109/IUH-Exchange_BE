package edu.iuh.exchange.userservice.application.service;

import edu.iuh.exchange.common.exception.BadRequestException;
import edu.iuh.exchange.common.exception.ResourceNotFoundException;
import edu.iuh.exchange.userservice.api.dto.*;
import edu.iuh.exchange.userservice.domain.model.OtpToken;
import edu.iuh.exchange.userservice.domain.model.User;
import edu.iuh.exchange.userservice.domain.repository.OtpRepository;
import edu.iuh.exchange.userservice.domain.repository.UserRepository;
import edu.iuh.exchange.userservice.infrastructure.email.EmailService;
import edu.iuh.exchange.userservice.infrastructure.security.JwtService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;

/**
 * Auth Service - Xử lý toàn bộ business logic xác thực
 *
 * Flows:
 * 1. register() → tạo user chưa verified + gửi OTP
 * 2. verifyOtp() → kích hoạt tài khoản
 * 3. login() → kiểm tra rate limit → verify password → cấp JWT
 * 4. refreshToken() → validate refresh token cookie → cấp access token mới
 * 5. logout() → xóa refresh token cookie
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final OtpRepository otpRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailService emailService;
    private final StringRedisTemplate redisTemplate;

    private static final String LOGIN_RATE_LIMIT_PREFIX = "login:attempts:";
    private static final int MAX_LOGIN_ATTEMPTS = 5;
    private static final Duration LOCKOUT_DURATION = Duration.ofMinutes(15);

    // ─────────────────────────────────────────────────────────
    // 1. ĐĂNG KÝ
    // ─────────────────────────────────────────────────────────

    @Transactional
    public String register(RegisterRequest request) {
        // Kiểm tra email đã tồn tại chưa
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BadRequestException("Email already registered: " + request.getEmail());
        }

        // Tạo user (chưa verified)
        User user = User.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .name(request.getName())
                .studentId(request.getStudentId())
                .isVerified(false)
                .build();

        userRepository.save(user);
        log.info("[Auth] New user registered: {}", request.getEmail());

        // Tạo và gửi OTP
        sendOtp(request.getEmail(), request.getName());

        return "Registration successful! Please check your email for OTP verification.";
    }

    // ─────────────────────────────────────────────────────────
    // 2. XÁC THỰC OTP
    // ─────────────────────────────────────────────────────────

    @Transactional
    public String verifyOtp(VerifyOtpRequest request) {
        OtpToken otpToken = otpRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new BadRequestException("No OTP found for this email. Please register first."));

        if (otpToken.isExpired()) {
            otpRepository.deleteByEmail(request.getEmail());
            throw new BadRequestException("OTP has expired. Please request a new one.");
        }

        if (otpToken.isMaxAttemptReached()) {
            throw new BadRequestException("Too many failed attempts. Please request a new OTP.");
        }

        if (!otpToken.getCode().equals(request.getOtp())) {
            otpToken.setAttemptCount(otpToken.getAttemptCount() + 1);
            otpRepository.save(otpToken);
            int remaining = 5 - otpToken.getAttemptCount();
            throw new BadRequestException("Invalid OTP. " + remaining + " attempts remaining.");
        }

        // Kích hoạt tài khoản
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("User", request.getEmail()));
        user.setVerified(true);
        userRepository.save(user);

        // Xóa OTP sau khi verify thành công
        otpRepository.deleteByEmail(request.getEmail());

        log.info("[Auth] Email verified successfully: {}", request.getEmail());
        return "Email verified successfully! You can now login.";
    }

    // ─────────────────────────────────────────────────────────
    // 3. ĐĂNG NHẬP
    // ─────────────────────────────────────────────────────────

    public AuthResponse login(LoginRequest request, HttpServletResponse response) {
        // Rate limiting: chống brute-force
        checkLoginRateLimit(request.getEmail());

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> {
                    incrementLoginAttempts(request.getEmail());
                    return new BadRequestException("Invalid email or password");
                });

        if (!user.isVerified()) {
            throw new BadRequestException("Email not verified. Please check your inbox for OTP.");
        }

        if (!user.isActive()) {
            throw new BadRequestException("Your account has been suspended.");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            incrementLoginAttempts(request.getEmail());
            throw new BadRequestException("Invalid email or password");
        }

        // Reset login attempts khi đăng nhập thành công
        redisTemplate.delete(LOGIN_RATE_LIMIT_PREFIX + request.getEmail());

        // Tạo tokens
        String accessToken  = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);

        // Gửi refresh token qua HttpOnly Cookie
        setRefreshTokenCookie(response, refreshToken);

        log.info("[Auth] User logged in: {}", user.getEmail());

        return AuthResponse.builder()
                .accessToken(accessToken)
                .userId(user.getId())
                .email(user.getEmail())
                .name(user.getName())
                .role(user.getRole().name())
                .permissions(user.getPermissions())
                .karmaPoint(user.getKarmaPoint())
                .build();
    }

    // ─────────────────────────────────────────────────────────
    // 4. REFRESH TOKEN
    // ─────────────────────────────────────────────────────────

    public AuthResponse refreshToken(String refreshToken, HttpServletResponse response) {
        if (refreshToken == null || !jwtService.validateToken(refreshToken)) {
            throw new BadRequestException("Invalid or missing refresh token");
        }

        String userId = jwtService.extractUserId(refreshToken);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        if (!user.isActive()) {
            throw new BadRequestException("Account is suspended");
        }

        String newAccessToken  = jwtService.generateAccessToken(user);
        String newRefreshToken = jwtService.generateRefreshToken(user);
        setRefreshTokenCookie(response, newRefreshToken);

        return AuthResponse.builder()
                .accessToken(newAccessToken)
                .userId(user.getId())
                .email(user.getEmail())
                .name(user.getName())
                .role(user.getRole().name())
                .permissions(user.getPermissions())
                .karmaPoint(user.getKarmaPoint())
                .build();
    }

    // ─────────────────────────────────────────────────────────
    // 5. LOGOUT
    // ─────────────────────────────────────────────────────────

    public void logout(HttpServletResponse response) {
        // Xóa refresh token cookie
        Cookie cookie = new Cookie("refreshToken", "");
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
    }

    // ─────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ─────────────────────────────────────────────────────────

    private void sendOtp(String email, String name) {
        String otp = generateOtp();

        OtpToken otpToken = OtpToken.builder()
                .email(email)
                .code(otp)
                .expiresAt(Instant.now().plus(Duration.ofMinutes(10)))
                .attemptCount(0)
                .build();

        // Xóa OTP cũ nếu có rồi lưu mới
        otpRepository.deleteByEmail(email);
        otpRepository.save(otpToken);

        // Gửi email bất đồng bộ
        emailService.sendOtpEmail(email, otp, name);
    }

    private String generateOtp() {
        return String.format("%06d", new SecureRandom().nextInt(1_000_000));
    }

    private void checkLoginRateLimit(String email) {
        String key = LOGIN_RATE_LIMIT_PREFIX + email;
        String attemptsStr = redisTemplate.opsForValue().get(key);
        int attempts = attemptsStr != null ? Integer.parseInt(attemptsStr) : 0;

        if (attempts >= MAX_LOGIN_ATTEMPTS) {
            Long ttl = redisTemplate.getExpire(key);
            throw new BadRequestException(
                String.format("Too many login attempts. Please try again after %d minutes.", 
                    ttl != null ? ttl / 60 : 15)
            );
        }
    }

    private void incrementLoginAttempts(String email) {
        String key = LOGIN_RATE_LIMIT_PREFIX + email;
        String current = redisTemplate.opsForValue().get(key);
        int attempts = current != null ? Integer.parseInt(current) : 0;
        redisTemplate.opsForValue().set(key, String.valueOf(attempts + 1), LOCKOUT_DURATION);
    }

    private void setRefreshTokenCookie(HttpServletResponse response, String refreshToken) {
        Cookie cookie = new Cookie("refreshToken", refreshToken);
        cookie.setHttpOnly(true);    // Không đọc được bằng JS
        cookie.setSecure(true);      // Chỉ qua HTTPS
        cookie.setPath("/");
        cookie.setMaxAge((int) (jwtService.getRefreshTokenExpiration() / 1000));
        response.addCookie(cookie);
    }
}
