package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.domain.model.VendorCategory;
import com.altarwed.infrastructure.persistence.entity.VendorEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VendorJpaRepository extends JpaRepository<VendorEntity, UUID> {

    Optional<VendorEntity> findByEmail(String email);

    boolean existsByEmail(String email);

    List<VendorEntity> findByCityIgnoreCaseAndIsActiveTrueAndIsVerifiedTrue(String city);

    List<VendorEntity> findByCityIgnoreCaseAndCategoryAndIsActiveTrueAndIsVerifiedTrue(String city, VendorCategory category);

    List<VendorEntity> findByCategoryAndIsActiveTrueAndIsVerifiedTrue(VendorCategory category);

    List<VendorEntity> findAllByIsActiveTrueAndIsVerifiedTrue();

    @Transactional
    @Modifying
    @Query("UPDATE VendorEntity v SET v.viewCount = v.viewCount + 1 WHERE v.id = :id")
    void incrementViewCount(UUID id);
}
