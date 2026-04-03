package edu.iuh.exchange.userservice.domain.model;

import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

/**
 * MongoDB User Document
 *
 * Lưu thông tin sinh viên IUH:
 * - email phải có đuôi @student.iuh.edu.vn
 * - password hash bằng BCrypt
 * - karmaPoint: ảnh hưởng đến permission CAN_POST
 * - permissions[]: RBAC chi tiết thay vì chỉ dựa vào role
 */
@Document(collection = "users")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    private String id;

    @Indexed(unique = true)
    private String email;

    private String passwordHash;
    private String name;
    private String studentId;       // Mã sinh viên IUH
    private String avatarUrl;       // URL ảnh từ S3

    @Builder.Default
    private boolean isVerified = false;   // Đã xác thực OTP email chưa

    @Builder.Default
    private boolean isActive = true;      // Bị ban thì set false

    @Builder.Default
    private int karmaPoint = 100;         // Điểm uy tín ban đầu = 100

    @Builder.Default
    private UserRole role = UserRole.STUDENT;

    @Builder.Default
    private List<String> permissions = List.of(
            Permission.CAN_POST,
            Permission.CAN_CHAT,
            Permission.CAN_REPORT
    );

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    // ─── Inner enums / constants ───

    public enum UserRole {
        STUDENT, MODERATOR, ADMIN
    }

    /**
     * Danh sách permissions chi tiết (RBAC)
     */
    public static class Permission {
        public static final String CAN_POST    = "CAN_POST";
        public static final String CAN_CHAT    = "CAN_CHAT";
        public static final String CAN_REPORT  = "CAN_REPORT";
        public static final String CAN_BAN     = "CAN_BAN";
        public static final String CAN_APPROVE = "CAN_APPROVE_POST";
    }
}
