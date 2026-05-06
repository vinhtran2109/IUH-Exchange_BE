package edu.iuh.exchange.lostfoundservice.api.controller;

import edu.iuh.exchange.common.dto.ApiResponse;
import edu.iuh.exchange.lostfoundservice.application.service.S3Service;

import edu.iuh.exchange.lostfoundservice.domain.model.LostFoundItem;
import edu.iuh.exchange.lostfoundservice.domain.repository.LostFoundItemRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/lost-found")
public class LostFoundController {

    private final LostFoundItemRepository itemRepository;
    private final S3Service s3Service;

    public LostFoundController(LostFoundItemRepository itemRepository, S3Service s3Service) {
        this.itemRepository = itemRepository;
        this.s3Service = s3Service;
    }

    @PostMapping("/upload-url")
    public ResponseEntity<ApiResponse<Map<String, String>>> getUploadUrl(@RequestBody Map<String, String> request) {
        String filename = request.get("filename");
        String contentType = request.get("contentType");
        String url = s3Service.generatePresignedUploadUrl(filename, contentType);
        
        // Trả về cả presignedUrl và publicUrl (giải thuật bóc tách từ presigned)
        String publicUrl = url.split("\\?")[0];
        return ResponseEntity.ok(ApiResponse.ok(Map.of(
            "presignedUrl", url,
            "publicUrl", publicUrl
        )));
    }


    @PostMapping
    public ResponseEntity<ApiResponse<LostFoundItem>> createItem(
            @RequestHeader("X-User-Id") String studentId,
            @RequestBody LostFoundItem item) {
        
        item.setStudentId(studentId);
        item.setStatus(LostFoundItem.ItemStatus.ACTIVE);
        
        LostFoundItem saved = itemRepository.save(item);
        return ResponseEntity.status(201).body(ApiResponse.created(saved));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<LostFoundItem>> getById(@PathVariable String id) {
        return itemRepository.findById(id)
                .map(item -> ResponseEntity.ok(ApiResponse.ok(item)))
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteItem(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String id) {
        
        return itemRepository.findById(id)
                .map(item -> {
                    if (!item.getStudentId().equals(userId)) {
                        return ResponseEntity.status(403).body(ApiResponse.<Void>error(403, "Bạn không có quyền gỡ bài này"));
                    }

                    
                    // Xóa ảnh trên S3 nếu có
                    if (item.getImageUrls() != null) {
                        item.getImageUrls().forEach(s3Service::deleteFileByUrl);
                    }
                    
                    itemRepository.deleteById(id);
                    return ResponseEntity.ok(ApiResponse.<Void>ok(null));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Page<LostFoundItem>>> getItems(

            @RequestParam(defaultValue = "LOST") LostFoundItem.ItemType type,
            @RequestParam(defaultValue = "ACTIVE") LostFoundItem.ItemStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        Page<LostFoundItem> items = itemRepository.findByTypeAndStatus(
                type, status,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        );
        return ResponseEntity.ok(ApiResponse.ok(items));
    }
}
