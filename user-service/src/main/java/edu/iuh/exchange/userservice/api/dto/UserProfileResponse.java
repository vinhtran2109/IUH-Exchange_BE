package edu.iuh.exchange.userservice.api.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/** DTO trả thông tin user profile */
@Getter
@Builder
public class UserProfileResponse {

    private String id;
    private String email;
    private String name;
    private String studentId;
    private String avatarUrl;
    @com.fasterxml.jackson.annotation.JsonProperty("isVerified")
    private boolean isVerified;
    
    @com.fasterxml.jackson.annotation.JsonProperty("isActive")
    private boolean isActive;
    private int karmaPoint;
    private String role;
    private List<String> permissions;
}

