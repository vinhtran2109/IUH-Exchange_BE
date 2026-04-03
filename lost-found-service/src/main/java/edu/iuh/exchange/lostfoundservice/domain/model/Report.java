package edu.iuh.exchange.lostfoundservice.domain.model;

import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "reports")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Report {

    @Id
    private String id;
    
    private String reporterId;     // Người tố cáo
    private String reportedUserId; // Người bị tố cáo (Seller hoặc Buyer gian lận)
    
    private String targetType;     // PRODUCT, USER, ORDER
    private String targetId;       // ID của sản phẩm, hoặc ID đơn hàng bị boom
    
    private String reason;         // Lý do tố cáo
    
    @Builder.Default
    private ReportStatus status = ReportStatus.PENDING;
    
    private String adminNote;      // Ghi chú của Admin khi xử lý
    
    @CreatedDate
    private Instant createdAt;

    public enum ReportStatus {
        PENDING, APPROVED, REJECTED
    }
}
