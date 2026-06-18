package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.EmailDeliveryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EmailDeliveryJpaRepository extends JpaRepository<EmailDeliveryEntity, UUID> {

    Optional<EmailDeliveryEntity> findByResendEmailId(String resendEmailId);

    List<EmailDeliveryEntity> findByCoupleId(UUID coupleId);
}
