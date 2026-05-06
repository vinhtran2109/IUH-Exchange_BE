package edu.iuh.exchange.productservice.api.controller;

import edu.iuh.exchange.common.dto.ApiResponse;
import edu.iuh.exchange.productservice.api.dto.CreateProductRequest;
import edu.iuh.exchange.productservice.api.dto.ProductResponse;
import edu.iuh.exchange.productservice.api.dto.UploadUrlRequest;
import edu.iuh.exchange.productservice.application.service.ProductService;
import edu.iuh.exchange.productservice.application.service.S3Service;
import edu.iuh.exchange.productservice.domain.model.ProductDocument;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/products")
public class ProductController {

    private final S3Service s3Service;
    private final ProductService productService;

    public ProductController(S3Service s3Service, ProductService productService) {
        this.s3Service = s3Service;
        this.productService = productService;
    }

    /**
     * Tìm kiếm Fuzzy Search qua ElasticSearch
     */
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<Page<ProductDocument>>> searchProducts(
            @RequestParam String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        Page<ProductDocument> results = productService.searchProducts(keyword, PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.ok(results, "Success Search"));
    }

    /**
     * Tải danh sách Sản phẩm (Pagination)
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<ProductResponse>>> getAvailableProducts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        Page<ProductResponse> products = productService.getAvailableProducts(PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.ok(products, "Success"));
    }

    /**
     * Lấy danh sách sản phẩm của chính tôi (Dùng cho Profile)
     */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<Page<ProductResponse>>> getMyProducts(
            @RequestHeader("X-User-Id") String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        
        Page<ProductResponse> products = productService.getProductsBySellerId(userId, PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.ok(products));
    }

    /**
     * Lấy 1 Product thông qua ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ProductResponse>> getProductById(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.ok(productService.getProductById(id), "Success"));
    }

    /**
     * Tạo mới 1 sản phẩm bán
     */
    @PostMapping
    public ResponseEntity<ApiResponse<ProductResponse>> createProduct(
            @RequestHeader("X-User-Id") String userId,
            @Valid @RequestBody CreateProductRequest request) {
        
        ProductResponse response = productService.createProduct(userId, request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(response.id())
                .toUri();
                
        return ResponseEntity.created(location).body(ApiResponse.created(response));
    }

    /**
     * Cập nhật thông tin sản phẩm
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ProductResponse>> updateProduct(
            @PathVariable String id,
            @RequestHeader("X-User-Id") String userId,
            @Valid @RequestBody CreateProductRequest request) {
        
        ProductResponse response = productService.updateProduct(id, userId, request);
        return ResponseEntity.ok(ApiResponse.ok(response, "Updated successfully"));
    }

    /**
     * Xóa sản phẩm
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteProduct(
            @PathVariable String id,
            @RequestHeader("X-User-Id") String userId) {
        
        productService.deleteProduct(id, userId);
        return ResponseEntity.ok(ApiResponse.ok(null, "Deleted successfully"));
    }

    /**
     * Lấy Pre-signed URL từ Amazon S3 để Frontend đẩy ảnh trực tiếp.
     */
    @PostMapping("/upload-url")
    public ResponseEntity<ApiResponse<Map<String, String>>> getPresignedUrl(
            @RequestHeader("X-User-Id") String userId,
            @RequestBody UploadUrlRequest request) {
        
        String url = s3Service.generatePresignedUploadUrl(request.filename(), request.contentType());
        String publicUrl = url.substring(0, url.indexOf("?"));

        return ResponseEntity.ok(ApiResponse.ok(
            Map.of("presignedUrl", url, "publicUrl", publicUrl),
            "Upload URL generated successfully"
        ));
    }

    // ==========================================
    // ADMIN ENDPOINTS
    // ==========================================

    @GetMapping("/admin/pending")
    public ResponseEntity<ApiResponse<Page<ProductResponse>>> getPendingProducts(
            @RequestHeader("X-User-Role") String role,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        Page<ProductResponse> products = productService.getPendingProducts(PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.ok(products, "Success"));
    }

    @PatchMapping("/admin/{id}/resolve")
    public ResponseEntity<ApiResponse<ProductResponse>> resolveProductStatus(
            @RequestHeader("X-User-Role") String role,
            @PathVariable String id,
            @RequestParam String action) {
        
        ProductResponse response = productService.resolveProductStatus(id, action);
        return ResponseEntity.ok(ApiResponse.ok(response, "Resolved successfully"));
    }

    /**
     * [ADMIN] Thống kê Dashboard
     */
    @GetMapping("/admin/stats")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getProductStats(
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        
        if (role == null || !"ADMIN".equals(role)) {
            return ResponseEntity.status(403).body(ApiResponse.error(403, "Quyền Admin là bắt buộc. Hiện tại: " + role));
        }
        
        return ResponseEntity.ok(ApiResponse.ok(productService.getProductStats()));
    }
}

