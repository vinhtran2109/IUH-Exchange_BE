package edu.iuh.exchange.userservice.api.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/** Response trả về sau khi Login thành công */
@Getter
@Builder
public class AuthResponse {

    private String accessToken;
    // refreshToken được gửi qua HttpOnly Cookie, KHÔNG trả trong body

    private String userId;
    private String email;
    private String name;
    private String role;
    private List<String> permissions;
    private int karmaPoint;
}
