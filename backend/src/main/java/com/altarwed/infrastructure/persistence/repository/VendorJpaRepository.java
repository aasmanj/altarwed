package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.domain.model.VendorCategory;
import com.altarwed.infrastructure.persistence.entity.VendorEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VendorJpaRepository extends JpaRepository<VendorEntity, UUID> {

    Optional<VendorEntity> findByEmail(String email);

    boolean existsByEmail(String email);

    List<VendorEntity> findByCityIgnoreCase(String city);

    List<VendorEntity> findByCityIgnoreCaseAndCategory(String city, VendorCategory category);

    List<VendorEntity> findByCategory(VendorCategory category);

    List<VendorEntity> findAllByIsActiveTrue();
}
