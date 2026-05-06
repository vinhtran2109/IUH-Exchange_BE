package edu.iuh.exchange.productservice.domain.repository;

import edu.iuh.exchange.productservice.domain.model.Product;
import edu.iuh.exchange.productservice.domain.model.ProductStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductRepository extends MongoRepository<Product, String> {
    
    // Phân trang các sản phẩm đang hiển thị (AVAILABLE)
    Page<Product> findByStatusOrderByCreatedAtDesc(ProductStatus status, Pageable pageable);
    
    // Xem các sản phẩm của một user cụ thể
    Page<Product> findBySellerIdOrderByCreatedAtDesc(String sellerId, Pageable pageable);
    
    // Tìm kiếm theo danh mục
    Page<Product> findByCategoryAndStatusOrderByCreatedAtDesc(String category, ProductStatus status, Pageable pageable);

    long countByStatus(ProductStatus status);
}
