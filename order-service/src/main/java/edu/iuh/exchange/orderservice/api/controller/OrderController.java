package edu.iuh.exchange.orderservice.api.controller;

import edu.iuh.exchange.common.dto.ApiResponse;
import edu.iuh.exchange.orderservice.api.dto.CreateOrderRequest;
import edu.iuh.exchange.orderservice.api.dto.OrderResponse;
import edu.iuh.exchange.orderservice.application.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    /**
     * Đặt mua sản phẩm.
     * Header X-User-Id: ID người mua (do API Gateway inject).
     * Body phải có idempotencyKey (UUID unique mỗi lần bấm nút).
     */
    @PostMapping
    public ResponseEntity<ApiResponse<OrderResponse>> createOrder(
            @RequestHeader("X-User-Id") String buyerId,
            @Valid @RequestBody CreateOrderRequest request) {

        OrderResponse response = orderService.createOrder(buyerId, request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(response.id()).toUri();
        return ResponseEntity.created(location).body(ApiResponse.created(response));
    }

    /**
     * Lấy danh sách đơn hàng đã đặt (tư cách người mua).
     */
    @GetMapping("/my-orders")
    public ResponseEntity<ApiResponse<List<OrderResponse>>> getMyOrders(
            @RequestHeader("X-User-Id") String userId) {
        return ResponseEntity.ok(ApiResponse.ok(orderService.getMyOrders(userId), "Success"));
    }

    /**
     * Lấy chi tiết 1 đơn hàng.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<OrderResponse>> getOrderById(@PathVariable String id) {
        return orderService.getOrderById(id)
                .map(order -> ResponseEntity.ok(ApiResponse.ok(order, "Success")))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Seller xác nhận đơn hàng.
     */
    @PostMapping("/{id}/confirm")
    public ResponseEntity<ApiResponse<OrderResponse>> confirmOrder(
            @PathVariable String id,
            @RequestHeader("X-User-Id") String sellerId) {

        OrderResponse response = orderService.confirmOrder(id, sellerId);
        return ResponseEntity.ok(ApiResponse.ok(response, "Order confirmed"));
    }

    /**
     * Seller từ chối đơn hàng.
     */
    @PatchMapping("/{id}/reject")
    public ResponseEntity<ApiResponse<OrderResponse>> rejectOrder(
            @PathVariable String id,
            @RequestHeader("X-User-Id") String sellerId,
            @RequestBody(required = false) Map<String, String> body) {

        String reason = body != null ? body.getOrDefault("reason", "Người bán từ chối đơn hàng") : "Người bán từ chối đơn hàng";
        OrderResponse response = orderService.rejectOrder(id, sellerId, reason);
        return ResponseEntity.ok(ApiResponse.ok(response, "Order rejected"));
    }
}
