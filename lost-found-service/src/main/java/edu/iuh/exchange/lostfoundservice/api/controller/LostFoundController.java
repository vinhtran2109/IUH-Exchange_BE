package edu.iuh.exchange.lostfoundservice.api.controller;

import edu.iuh.exchange.common.dto.ApiResponse;
import edu.iuh.exchange.lostfoundservice.domain.model.LostFoundItem;
import edu.iuh.exchange.lostfoundservice.domain.repository.LostFoundItemRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/lost-found")
public class LostFoundController {

    private final LostFoundItemRepository itemRepository;

    public LostFoundController(LostFoundItemRepository itemRepository) {
        this.itemRepository = itemRepository;
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
