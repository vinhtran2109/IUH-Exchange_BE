package edu.iuh.exchange.orderservice.infrastructure.messaging;

/**
 * Tập hợp tên các Kafka Topic trong hệ thống SAGA của Order Service.
 */
public final class OrderTopics {
    // Order Service phát ra
    public static final String ORDER_CREATED   = "order.created";
    public static final String ORDER_CANCELLED = "order.cancelled";
    public static final String ORDER_COMPLETED = "order.completed";

    // Product Service phát ra (Order Service lắng nghe)
    public static final String PRODUCT_RESERVED        = "product.reserved";
    public static final String PRODUCT_RESERVE_FAILED  = "product.reserve.failed";

    private OrderTopics() {}
}
