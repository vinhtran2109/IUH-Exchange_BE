package edu.iuh.exchange.lostfoundservice.domain.repository;

import edu.iuh.exchange.lostfoundservice.domain.model.LostFoundItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LostFoundItemRepository extends MongoRepository<LostFoundItem, String> {
    Page<LostFoundItem> findByTypeAndStatus(LostFoundItem.ItemType type, LostFoundItem.ItemStatus status, Pageable pageable);
}
