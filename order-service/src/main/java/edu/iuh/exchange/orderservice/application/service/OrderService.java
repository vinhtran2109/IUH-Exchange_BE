package edu.iuh.exchange.orderservice.application.service;

import edu.iuh.exchange.orderservice.api.dto.CreateOrderRequest;
import edu.iuh.exchange.orderservice.api.dto.OrderResponse;
import edu.iuh.exchange.orderservice.domain.model.Order;
import edu.iuh.exchange.orderservice.domain.model.OrderStatus;
import edu.iuh.exchange.orderservice.domain.repository.OrderRepository;
import edu.iuh.exchange.orderservice.infrastructure.messaging.OrderCreatedEvent;
import edu.iuh.exchange.orderservice.infrastructure.messaging.OrderEventProducer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

@Service
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    // Thời gian giữ Idempotency Key trong Redis (24 giờ)
    private static final Duration IDEMPOTENCY_TTL = Duration.ofHours(24);

    private final OrderRepository orderRepository;
    private final OrderEventProducer eventProducer;
    private final StringRedisTemplate redisTemplate;

    public OrderService(OrderRepository orderRepository,
                        OrderEventProducer eventProducer,
                        StringRedisTemplate redisTemplate) {
        this.orderRepository = orderRepository;
        this.eventProducer = eventProducer;
        this.redisTemplate = redisTemplate;
    }

    /**
     * Tạo đơn hàng mới - Bảo vệ bởi Idempotency Key (Redis).
     * Nếu cùng Key gửi lại lần 2 → trả về Order cũ, không tạo mới.
     */
    public OrderResponse createOrder(String buyerId, CreateOrderRequest request) {

        // ── STEP 1: Kiểm tra Idempotency (chống Duplicate) ──────────
        String redisKey = "idempotency:order:" + request.idempotencyKey();
        Boolean isNew = redisTemplate.opsForValue().setIfAbsent(redisKey, "PROCESSING", IDEMPOTENCY_TTL);

        if (Boolean.FALSE.equals(isNew)) {
            // Key đã tồn tại → Request bị gửi trùng, tìm và trả về Order đã tạo
            log.warn("⚠️ Duplicate order request detected! idempotencyKey={}", request.idempotencyKey());
            return orderRepository.findByIdempotencyKey(request.idempotencyKey())
                    .map(OrderResponse::fromEntity)
                    .orElseThrow(() -> new IllegalStateException("Order đang được xử lý, vui lòng chờ..."));
        }

        // ── STEP 2: Không được tự mua hàng của mình ────────────────
        if (buyerId.equals(request.sellerId())) {
            redisTemplate.delete(redisKey);
            throw new IllegalArgumentException("Bạn không thể mua sản phẩm của chính mình!");
        }

        // ── STEP 3: Lưu Order vào MongoDB với status = PENDING ──────
        Order order = new Order();
        order.setBuyerId(buyerId);
        order.setSellerId(request.sellerId());
        order.setProductId(request.productId());
        order.setPrice(request.price());
        order.setBuyerNote(request.buyerNote());
        order.setIdempotencyKey(request.idempotencyKey());
        order.setStatus(OrderStatus.PENDING);

        Order saved = orderRepository.save(order);
        log.info("✅ [SAGA Step 1] Order created: orderId={}, productId={}", saved.getId(), saved.getProductId());

        // ── STEP 4: Phát sự kiện SAGA → Product Service sẽ Reserve sản phẩm ──
        eventProducer.publishOrderCreated(new OrderCreatedEvent(
                saved.getId(), saved.getProductId(),
                saved.getBuyerId(), saved.getSellerId(), saved.getPrice()
        ));

        // Cập nhật Redis Key với orderId để lần sau tra cứu được
        redisTemplate.opsForValue().set(redisKey, saved.getId(), IDEMPOTENCY_TTL);

        return OrderResponse.fromEntity(saved);
    }

    /**
     * Product đã reserve xong, đơn hàng chờ người bán xác nhận.
     */
    public void markAwaitingSellerConfirmation(String orderId) {
        orderRepository.findById(orderId).ifPresent(order -> {
            if (order.getStatus() == OrderStatus.CANCELLED || order.getStatus() == OrderStatus.COMPLETED) {
                return;
            }

            order.setStatus(OrderStatus.CONFIRMED);
            orderRepository.save(order);
            log.info("✅ [SAGA Step 2] Order awaiting seller confirmation: orderId={}", orderId);
        });
    }

    /**
     * SAGA Compensating Transaction:
     * Product Service báo về "Reserve thất bại" → Order Service tự hủy Order.
     */
    public void cancelOrder(String orderId, String reason) {
        orderRepository.findById(orderId).ifPresent(order -> {
            order.setStatus(OrderStatus.CANCELLED);
            orderRepository.save(order);
            log.info("❌ [SAGA Rollback] Order cancelled: orderId={}, reason={}", orderId, reason);
            eventProducer.publishOrderCancelled(orderId, order.getProductId(), reason);
        });
    }

    /**
     * Seller xác nhận đơn → Hoàn tất giao dịch + trừ/cộng KarmaPoint.
     */
    public OrderResponse confirmOrder(String orderId, String sellerId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new edu.iuh.exchange.common.exception.ResourceNotFoundException("Order", orderId));

        if (!order.getSellerId().equals(sellerId)) {
            throw new edu.iuh.exchange.common.exception.ForbiddenException("Bạn không có quyền xác nhận đơn này");
        }

        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new edu.iuh.exchange.common.exception.BadRequestException("Đơn hàng đã bị hủy");
        }

        order.setStatus(OrderStatus.COMPLETED);
        Order saved = orderRepository.save(order);
        log.info("🏆 [SELLER CONFIRM] Order completed: orderId={}, sellerId={}", orderId, sellerId);

        eventProducer.publishOrderCompleted(orderId, order.getBuyerId(), order.getSellerId(), order.getProductId());
        return OrderResponse.fromEntity(saved);
    }

    public OrderResponse rejectOrder(String orderId, String sellerId, String reason) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new edu.iuh.exchange.common.exception.ResourceNotFoundException("Order", orderId));

        if (!order.getSellerId().equals(sellerId)) {
            throw new edu.iuh.exchange.common.exception.ForbiddenException("Bạn không có quyền từ chối đơn này");
        }

        if (order.getStatus() == OrderStatus.COMPLETED) {
            throw new edu.iuh.exchange.common.exception.BadRequestException("Đơn hàng đã được xác nhận");
        }

        order.setStatus(OrderStatus.CANCELLED);
        Order saved = orderRepository.save(order);
        log.info("❌ [SELLER REJECT] Order cancelled: orderId={}, sellerId={}, reason={}", orderId, sellerId, reason);

        eventProducer.publishOrderCancelled(orderId, order.getProductId(), reason);
        return OrderResponse.fromEntity(saved);
    }

    public List<OrderResponse> getMyOrders(String userId) {
        return orderRepository.findByBuyerIdOrderByCreatedAtDesc(userId)
                .stream().map(OrderResponse::fromEntity).toList();
    }

    public Optional<OrderResponse> getOrderById(String orderId) {
        return orderRepository.findById(orderId).map(OrderResponse::fromEntity);
    }
}
