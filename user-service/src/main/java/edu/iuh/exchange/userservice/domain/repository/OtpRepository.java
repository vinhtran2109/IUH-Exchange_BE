package edu.iuh.exchange.userservice.domain.repository;

import edu.iuh.exchange.userservice.domain.model.OtpToken;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OtpRepository extends MongoRepository<OtpToken, String> {

    Optional<OtpToken> findByEmail(String email);

    void deleteByEmail(String email);
}
