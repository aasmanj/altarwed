package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.RsvpInviteTokenEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

public interface RsvpInviteTokenJpaRepository extends JpaRepository<RsvpInviteTokenEntity, UUID> {
    Optional<RsvpInviteTokenEntity> findByTokenHash(String tokenHash);
    void deleteAllByGuestId(UUID guestId);

    @Modifying
    @Query("UPDATE RsvpInviteTokenEntity t SET t.used = true, t.usedAt = :now WHERE t.tokenHash = :tokenHash")
    void markUsed(@Param("tokenHash") String tokenHash, @Param("now") LocalDateTime now);
}
