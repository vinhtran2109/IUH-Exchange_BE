package edu.iuh.exchange.userservice.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;

/**
 * DTO cho API Đăng ký tài khoản
 * POST /api/v1/auth/register
 */
@Getter
public class RegisterRequest {

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    @Pattern(
        regexp = "^[a-zA-Z0-9._%+\\-]+@student\\.iuh\\.edu\\.vn$",
        message = "Email must be from IUH student domain (@student.iuh.edu.vn)"
    )
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 8, max = 50, message = "Password must be between 8 and 50 characters")
    private String password;

    @NotBlank(message = "Name is required")
    @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters")
    private String name;

    @NotBlank(message = "Student ID is required")
    @Pattern(regexp = "^\\d{8}$", message = "Student ID must be 8 digits")
    private String studentId;
}
