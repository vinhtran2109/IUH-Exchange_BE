package edu.iuh.exchange.orderservice.domain.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "orders")
public class Order {

    @Id
    private String id;

    /** ID của sinh viên Mua hàng */
    private String buyerId;

    /** ID của sinh viên Bán hàng */
    private String sellerId;

    /** ID sản phẩm liên quan */
    private String productId;

    /** Giá tại thời điểm đặt hàng (Snapshot, đề phòng người bán sửa giá sau) */
    private Double price;

    /** Trạng thái SAGA */
    private OrderStatus status;

    /** Ghi chú thêm từ người mua */
    private String buyerNote;

    /** Idempotency Key: ngăn chặn đặt hàng trùng do bấm nhiều lần */
    private String idempotencyKey;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    // ─── Getters & Setters ───────────────────────────────────────
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getBuyerId() { return buyerId; }
    public void setBuyerId(String buyerId) { this.buyerId = buyerId; }

    public String getSellerId() { return sellerId; }
    public void setSellerId(String sellerId) { this.sellerId = sellerId; }

    public String getProductId() { return productId; }
    public void setProductId(String productId) { this.productId = productId; }

    public Double getPrice() { return price; }
    public void setPrice(Double price) { this.price = price; }

    public OrderStatus getStatus() { return status; }
    public void setStatus(OrderStatus status) { this.status = status; }

    public String getBuyerNote() { return buyerNote; }
    public void setBuyerNote(String buyerNote) { this.buyerNote = buyerNote; }

    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
