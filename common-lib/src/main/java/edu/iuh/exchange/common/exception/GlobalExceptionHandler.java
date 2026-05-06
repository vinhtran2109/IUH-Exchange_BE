package edu.iuh.exchange.common.exception;

import edu.iuh.exchange.common.dto.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

/**
 * ============================================
 * Centralized Exception Handler
 * ============================================
 * Xử lý lỗi format chung cho toàn bộ APIs.
 * Mọi service đều kế thừa class này hoặc scan component từ common-lib.
 *
 * Tất cả response lỗi đều theo format chuẩn ApiResponse:
 * {
 *   "success": false,
 *   "statusCode": 4xx/5xx,
 *   "message": "Chi tiết lỗi",
 *   "timestamp": "..."
 * }
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Xử lý các exception business logic (extends BaseException)
     */
    @ExceptionHandler(BaseException.class)
    public ResponseEntity<ApiResponse<Void>> handleBaseException(BaseException ex) {
        log.warn("[{}] {}: {}", ex.getStatus().value(), ex.getErrorCode(), ex.getMessage());
        return ResponseEntity
                .status(ex.getStatus())
                .body(ApiResponse.error(ex.getStatus().value(), ex.getMessage()));
    }

    /**
     * Xử lý lỗi Validation (@Valid / @Validated)
     * Trả về map field -> message chi tiết
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidationException(
            MethodArgumentNotValidException ex) {

        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String fieldName = ((FieldError) error).getField();
            String message = error.getDefaultMessage();
            errors.put(fieldName, message);
        });

        log.warn("[400] Validation failed: {}", errors);
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.<Map<String, String>>builder()
                        .success(false)
                        .statusCode(400)
                        .message("Validation failed")
                        .data(errors)
                        .timestamp(java.time.Instant.now().toString())
                        .build());
    }

    /**
     * Xử lý lỗi 404 (ResourceNotFoundException)
     */
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleResourceNotFoundException(ResourceNotFoundException ex) {
        log.warn("[404] Resource not found: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(404, ex.getMessage()));
    }

    /**
     * Xử lý lỗi thiếu header bắt buộc (MissingRequestHeaderException)
     */
    @ExceptionHandler(org.springframework.web.bind.MissingRequestHeaderException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingHeaderException(org.springframework.web.bind.MissingRequestHeaderException ex) {
        log.warn("[400] Missing required header: {}", ex.getHeaderName());
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(400, "Missing required header: " + ex.getHeaderName()));
    }

    /**
     * Xử lý bất kỳ exception không mong muốn nào (Fallback handler)
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGenericException(Exception ex) {
        log.error("[500] Unhandled exception: {}", ex.getMessage(), ex);
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error(500, "An unexpected error occurred. Please try again later."));
    }
}
