package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.EmailSuppressionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface EmailSuppressionJpaRepository extends JpaRepository<EmailSuppressionEntity, UUID> {

    boolean existsByEmailHash(String emailHash);
}
