package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.VendorListingNudgeSendEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface VendorListingNudgeSendJpaRepository
        extends JpaRepository<VendorListingNudgeSendEntity, UUID> {

    boolean existsByVendorId(UUID vendorId);
}
