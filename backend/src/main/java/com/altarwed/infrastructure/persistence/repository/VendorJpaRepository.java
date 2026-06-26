package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.domain.model.VendorCategory;
import com.altarwed.infrastructure.persistence.entity.VendorEntity;
import org.springframework.data.domain.Pageable;
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

    List<VendorEntity> findByCityIgnoreCaseAndIsActiveTrueAndIsVerifiedTrue(String city, Pageable pageable);

    List<VendorEntity> findByCityIgnoreCaseAndCategoryAndIsActiveTrueAndIsVerifiedTrue(String city, VendorCategory category, Pageable pageable);

    List<VendorEntity> findByCategoryAndIsActiveTrueAndIsVerifiedTrue(VendorCategory category, Pageable pageable);

    List<VendorEntity> findAllByIsActiveTrueAndIsVerifiedTrue(Pageable pageable);

    @Transactional
    @Modifying
    @Query("UPDATE VendorEntity v SET v.viewCount = v.viewCount + 1 WHERE v.id = :id")
    void incrementViewCount(UUID id);
}
