package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.VendorPromoCodeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface VendorPromoCodeJpaRepository extends JpaRepository<VendorPromoCodeEntity, UUID> {
    Optional<VendorPromoCodeEntity> findByCodeIgnoreCase(String code);
}
