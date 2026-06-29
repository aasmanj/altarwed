package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.VendorPromoRedemptionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface VendorPromoRedemptionJpaRepository extends JpaRepository<VendorPromoRedemptionEntity, UUID> {
}
