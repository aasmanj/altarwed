package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.CoupleEmailOptOutEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface CoupleEmailOptOutJpaRepository extends JpaRepository<CoupleEmailOptOutEntity, UUID> {

    boolean existsByCoupleIdAndEmailHash(UUID coupleId, String emailHash);

    List<CoupleEmailOptOutEntity> findByCoupleIdAndEmailHashIn(UUID coupleId, Collection<String> emailHashes);

    // Derived delete; runs inside the caller's transaction. Returns rows removed so the
    // resubscribe-on-RSVP path can tell "was opted out" from "nothing to do".
    long deleteByCoupleIdAndEmailHash(UUID coupleId, String emailHash);
}
