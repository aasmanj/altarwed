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

    // Most recent still-valid (unused, unexpired) token a guest holds that was minted by the
    // find-invitation search. Lets the search rotate that one row in place instead of inserting
    // a new token per name guess; never matches an email-invite token (different source).
    Optional<RsvpInviteTokenEntity> findFirstByGuestIdAndSourceAndUsedFalseAndExpiresAtAfterOrderByExpiresAtDesc(
            UUID guestId, String source, LocalDateTime now);

    @Modifying
    @Query("UPDATE RsvpInviteTokenEntity t SET t.used = true, t.usedAt = :now WHERE t.tokenHash = :tokenHash")
    void markUsed(@Param("tokenHash") String tokenHash, @Param("now") LocalDateTime now);
}
