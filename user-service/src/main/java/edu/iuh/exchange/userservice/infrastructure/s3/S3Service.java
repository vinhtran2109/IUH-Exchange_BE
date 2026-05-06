package edu.iuh.exchange.userservice.infrastructure.s3;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.ObjectCannedACL;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class S3Service {

    private final S3Client s3Client;

    @Value("${aws.s3.bucket-name}")
    private String bucketName;

    @Value("${aws.s3.region}")
    private String region;

    /**
     * Upload ảnh lên S3 và trả về URL public
     */
    public String uploadAvatar(MultipartFile file) {
        String fileName = "avatars/" + UUID.randomUUID() + "_" + file.getOriginalFilename();
        
        try {
            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(fileName)
                    .contentType(file.getContentType())
                    // Bỏ public-read ACL để tránh lỗi AccessDenied từ S3 Block Public Access
                    .build();

            s3Client.putObject(putObjectRequest, RequestBody.fromBytes(file.getBytes()));
            
            // Xây dựng URL: https://bucket-name.s3.region.amazonaws.com/file-name
            String url = String.format("https://%s.s3.%s.amazonaws.com/%s", bucketName, region, fileName);
            log.info("🚀 [S3] Uploaded avatar successfully: {}", url);
            return url;
            
        } catch (Exception e) {
            log.error("❌ [S3] Failed to upload file: {}", e.getMessage());
            throw new RuntimeException("Lỗi khi tải ảnh lên S3: " + e.getMessage());
        }
    }
}
