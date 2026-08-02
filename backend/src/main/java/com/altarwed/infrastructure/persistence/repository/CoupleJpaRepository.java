package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.CoupleEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CoupleJpaRepository extends JpaRepository<CoupleEntity, UUID> {

    Optional<CoupleEntity> findByEmail(String email);

    boolean existsByEmail(String email);

    // Active couples created within the inclusive [from, to] window (issue #551 win-back). A
    // JPQL query rather than a derived name so the isActive=true filter is explicit and the
    // window bounds read unambiguously. The scheduler passes a narrow window (a few weeks), so
    // this seeks a small slice, never the whole table.
    @Query("select c from CoupleEntity c "
            + "where c.isActive = true and c.createdAt between :from and :to")
    List<CoupleEntity> findActiveCreatedBetween(@Param("from") LocalDateTime from,
                                                @Param("to") LocalDateTime to);
}
