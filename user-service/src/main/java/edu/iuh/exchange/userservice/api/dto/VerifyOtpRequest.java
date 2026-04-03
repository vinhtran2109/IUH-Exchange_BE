package edu.iuh.exchange.userservice.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;

/** DTO cho API Xác thực OTP - POST /api/v1/auth/verify-otp */
@Getter
public class VerifyOtpRequest {

    @NotBlank @Email
    private String email;

    @NotBlank
    @Pattern(regexp = "^\\d{6}$", message = "OTP must be 6 digits")
    private String otp;
}
