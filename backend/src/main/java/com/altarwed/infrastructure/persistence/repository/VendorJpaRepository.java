package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.domain.model.VendorCategory;
import com.altarwed.infrastructure.persistence.entity.VendorEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VendorJpaRepository extends JpaRepository<VendorEntity, UUID> {

    Optional<VendorEntity> findByEmail(String email);

    boolean existsByEmail(String email);

    // Single dynamic directory query: filters, sort, and paging all run in the database (issue
    // #135). Each filter is optional via the "(:x IS NULL OR ...)" idiom, so one query serves
    // every category/city/priceTier combination without exploding into a method per combination.
    // The ORDER BY comes from the Pageable's Sort (built in the adapter); the OFFSET/FETCH page
    // slice comes from the Pageable's page/size. city is matched case-insensitively to preserve
    // the previous findByCityIgnoreCase semantics. On SQL Server the default collation already
    // orders business_name case-insensitively, so the sort needs no LOWER() (keeping it index-able).
    @Query("""
            SELECT v FROM VendorEntity v
            WHERE v.isActive = true AND v.isVerified = true
              AND (:category IS NULL OR v.category = :category)
              AND (:city IS NULL OR LOWER(v.city) = LOWER(:city))
              AND (:priceTier IS NULL OR v.priceTier = :priceTier)
            """)
    List<VendorEntity> findDirectory(@Param("category") VendorCategory category,
                                     @Param("city") String city,
                                     @Param("priceTier") String priceTier,
                                     Pageable pageable);

    @Query("""
            SELECT COUNT(v) FROM VendorEntity v
            WHERE v.isActive = true AND v.isVerified = true
              AND (:category IS NULL OR v.category = :category)
              AND (:city IS NULL OR LOWER(v.city) = LOWER(:city))
              AND (:priceTier IS NULL OR v.priceTier = :priceTier)
            """)
    long countDirectory(@Param("category") VendorCategory category,
                        @Param("city") String city,
                        @Param("priceTier") String priceTier);

    long countByIsVerifiedTrue();

    @Transactional
    @Modifying
    @Query("UPDATE VendorEntity v SET v.viewCount = v.viewCount + 1 WHERE v.id = :id")
    void incrementViewCount(UUID id);
}
