package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.VendorPortfolioPhotoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface VendorPortfolioPhotoJpaRepository extends JpaRepository<VendorPortfolioPhotoEntity, UUID> {
    List<VendorPortfolioPhotoEntity> findAllByVendorIdOrderBySortOrderAsc(UUID vendorId);
    boolean existsByIdAndVendorId(UUID id, UUID vendorId);
    int countByVendorId(UUID vendorId);
}
