package edu.iuh.exchange.productservice.domain.repository;

import edu.iuh.exchange.productservice.domain.model.ProductDocument;
import edu.iuh.exchange.productservice.domain.model.ProductStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProductSearchRepository extends ElasticsearchRepository<ProductDocument, String> {
    
    // Tìm kiếm mờ (Fuzzy) theo Title HOẶC Description
    Page<ProductDocument> findByTitleMatchesOrDescriptionMatchesAndStatus(
            String title, String description, ProductStatus status, Pageable pageable);
}
