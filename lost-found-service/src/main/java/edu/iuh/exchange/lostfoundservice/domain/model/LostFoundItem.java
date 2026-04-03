package edu.iuh.exchange.lostfoundservice.domain.model;

import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document(collection = "lost_found_items")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LostFoundItem {

    @Id
    private String id;
    
    private String studentId;      // Người đăng bài
    
    private String title;          // Ví dụ: "Nhặt được chìa khóa xe ở nhà xe H"
    private String description;
    
    private ItemType type;         // Lạc mất (LOST) hay Nhặt được (FOUND)
    private ItemStatus status;     // Đang tìm (ACTIVE) hay Đã giải quyết (RESOLVED)
    
    private String location;       // Khu vực nhặt/mất
    private String contactInfo;    // SĐT hoặc Zalo liên hệ
    
    private List<String> imageUrls; // Ảnh chụp đồ vật
    
    @CreatedDate
    private Instant createdAt;
    
    @LastModifiedDate
    private Instant updatedAt;

    public enum ItemType {
        LOST, FOUND
    }

    public enum ItemStatus {
        ACTIVE, RESOLVED, HIDDEN
    }
}
