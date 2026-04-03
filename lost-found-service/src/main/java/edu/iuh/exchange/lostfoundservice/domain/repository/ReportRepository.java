package edu.iuh.exchange.lostfoundservice.domain.repository;

import edu.iuh.exchange.lostfoundservice.domain.model.Report;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ReportRepository extends MongoRepository<Report, String> {
    Page<Report> findByStatus(Report.ReportStatus status, Pageable pageable);
}
