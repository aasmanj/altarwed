package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.domain.model.GuestRsvpStatus;
import com.altarwed.infrastructure.persistence.entity.GuestEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface GuestJpaRepository extends JpaRepository<GuestEntity, UUID> {
    List<GuestEntity> findAllByCoupleId(UUID coupleId);
    boolean existsByIdAndCoupleId(UUID id, UUID coupleId);

    // Finds guests whose reminder is due: remind_at is set, it is on or before asOf,
    // and the guest is still PENDING (has not yet responded).
    @Query("SELECT g FROM GuestEntity g WHERE g.remindAt IS NOT NULL AND g.remindAt <= :asOf AND g.rsvpStatus = :pending")
    List<GuestEntity> findDueReminders(@Param("asOf") LocalDateTime asOf,
                                       @Param("pending") GuestRsvpStatus pending);
}
