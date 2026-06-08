package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.InquiryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface InquiryJpaRepository extends JpaRepository<InquiryEntity, UUID> {

    List<InquiryEntity> findByVendorIdOrderByCreatedAtDesc(UUID vendorId);

    long countByVendorId(UUID vendorId);

    long countByVendorIdAndIsReadFalse(UUID vendorId);

    boolean existsByIdAndVendorId(UUID id, UUID vendorId);

    @Modifying
    @Query("UPDATE InquiryEntity i SET i.isRead = true WHERE i.id = :id")
    void markReadById(@Param("id") UUID id);
}
