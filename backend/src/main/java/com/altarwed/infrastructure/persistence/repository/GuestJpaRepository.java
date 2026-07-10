package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.domain.model.GuestRsvpStatus;
import com.altarwed.infrastructure.persistence.entity.GuestEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface GuestJpaRepository extends JpaRepository<GuestEntity, UUID> {
    List<GuestEntity> findAllByCoupleId(UUID coupleId);
    boolean existsByIdAndCoupleId(UUID id, UUID coupleId);

    // Finds guests whose reminder is due: remind_at is set, it is on or before asOf,
    // the guest is still PENDING (has not yet responded), and the guest is still below the
    // invite-send cap. The cap predicate (issue #233) stops a guest who deferred until they
    // reached the cap from staying due forever, since issueInvite would reject the send at the
    // cap check on every hourly run. invite_send_count is NOT NULL in the schema, so no null
    // guard is needed. Backed by the filtered ix_guests_remind_at index (WHERE remind_at IS NOT
    // NULL) which now covers invite_send_count too, see V87.
    @Query("SELECT g FROM GuestEntity g WHERE g.remindAt IS NOT NULL AND g.remindAt <= :asOf "
            + "AND g.rsvpStatus = :pending AND g.inviteSendCount < :maxInviteSends")
    List<GuestEntity> findDueReminders(@Param("asOf") LocalDateTime asOf,
                                       @Param("pending") GuestRsvpStatus pending,
                                       @Param("maxInviteSends") int maxInviteSends);

    List<GuestEntity> findAllByPartyIdOrderByCreatedAt(UUID partyId);

    List<GuestEntity> findAllByCoupleIdAndNameContainingIgnoreCase(UUID coupleId, String name);

    // Bulk stamp of save_the_date_sent_at for a batch of guests in one UPDATE.
    // clearAutomatically = true evicts the L1 persistence context after the JPQL
    // UPDATE so any guest already loaded in this transaction is re-read fresh rather
    // than keeping its stale (pre-update) saveTheDateSentAt. A bulk UPDATE bypasses
    // @PreUpdate, so we set updated_at here too to keep it honest with the new stamp.
    @Modifying(clearAutomatically = true)
    @Query("UPDATE GuestEntity g SET g.saveTheDateSentAt = :sentAt, g.updatedAt = :sentAt WHERE g.id IN :ids")
    void markSaveTheDatesSent(@Param("ids") Collection<UUID> ids, @Param("sentAt") LocalDateTime sentAt);

    // Seating table delete reindex (bulk, no entity hydration). The guest seat is a 1-based
    // position into the couple's sortOrder-ordered table list, so deleting a table at `position`
    // must unassign the guests seated there and shift later guests down one. Two targeted UPDATEs
    // keep the write lock to only the affected rows. ORDER MATTERS: the caller must run the
    // unassign BEFORE the shift, or the shift would move a row into `position` that the unassign
    // then wrongly nulls. clearAutomatically so the persistence context can't serve stale rows.
    @Modifying(clearAutomatically = true)
    @Query("UPDATE GuestEntity g SET g.tableNumber = NULL WHERE g.coupleId = :coupleId AND g.tableNumber = :position")
    int unassignGuestsAtTablePosition(@Param("coupleId") UUID coupleId, @Param("position") int position);

    @Modifying(clearAutomatically = true)
    @Query("UPDATE GuestEntity g SET g.tableNumber = g.tableNumber - 1 WHERE g.coupleId = :coupleId AND g.tableNumber > :position")
    int shiftGuestsAfterTablePosition(@Param("coupleId") UUID coupleId, @Param("position") int position);
}
