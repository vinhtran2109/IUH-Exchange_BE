package edu.iuh.exchange.userservice.domain.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * OTP Document - Lưu mã xác thực email tạm thời
 *
 * OTP tự động hết hạn sau 10 phút.
 * Sau khi verify thành công thì xóa document này đi.
 */
@Document(collection = "otps")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OtpToken {

    @Id
    private String id;

    @Indexed(unique = true)
    private String email;

    private String code;             // 6 chữ số
    private Instant expiresAt;       // Hết hạn sau 10 phút
    private int attemptCount;        // Đếm số lần nhập sai (max 5)

    @Builder.Default
    private boolean used = false;

    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }

    public boolean isMaxAttemptReached() {
        return attemptCount >= 5;
    }
}
