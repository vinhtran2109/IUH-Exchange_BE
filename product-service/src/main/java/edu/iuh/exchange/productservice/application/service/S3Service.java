package edu.iuh.exchange.productservice.application.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.time.Duration;
import java.util.UUID;

@Service
public class S3Service {

    private final S3Presigner s3Presigner;
    private final S3Client s3Client;

    @Value("${aws.s3.bucket-name}")
    private String bucketName;

    @Value("${aws.s3.presigned-url-expiry}")
    private long expirySeconds;

    public S3Service(S3Presigner s3Presigner, S3Client s3Client) {
        this.s3Presigner = s3Presigner;
        this.s3Client = s3Client;
    }

    /**
     * Generate Pre-signed URL cho Client tự upload ảnh lên S3
     */
    public String generatePresignedUploadUrl(String originalFilename, String contentType) {
        // ... (Giữ nguyên logic cũ)
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        String objectKey = "products/" + UUID.randomUUID() + extension;

        PutObjectRequest objectRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(objectKey)
                .contentType(contentType)
                .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofSeconds(expirySeconds))
                .putObjectRequest(objectRequest)
                .build();

        PresignedPutObjectRequest presignedRequest = s3Presigner.presignPutObject(presignRequest);
        
        return presignedRequest.url().toString();
    }

    /**
     * ✅ Xóa file khỏi S3 dựa trên Public URL
     */
    public void deleteFileByUrl(String publicUrl) {
        try {
            // VD URL: https://bucket.s3.region.amazonaws.com/products/abc.jpg
            // ObjectKey sẽ là: products/abc.jpg
            String objectKey = publicUrl.substring(publicUrl.indexOf("products/"));
            
            DeleteObjectRequest deleteRequest = DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .build();
            
            s3Client.deleteObject(deleteRequest);
        } catch (Exception e) {
            // Không throw exception để tránh làm hỏng luồng xóa bài chính
            System.err.println("⚠️ Lỗi xóa ảnh trên S3: " + e.getMessage());
        }
    }
}

