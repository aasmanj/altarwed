package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.port.VendorListingNudgeRepository;
import com.altarwed.infrastructure.persistence.entity.VendorListingNudgeSendEntity;
import com.altarwed.infrastructure.persistence.repository.VendorListingNudgeSendJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@RequiredArgsConstructor
public class VendorListingNudgeRepositoryAdapter implements VendorListingNudgeRepository {

    private final VendorListingNudgeSendJpaRepository jpaRepository;

    @Override
    public boolean existsByVendorId(UUID vendorId) {
        return jpaRepository.existsByVendorId(vendorId);
    }

    /**
     * saveAndFlush, not save: the insert must hit the database now so a concurrent duplicate
     * raises the unique violation inside the caller's transaction (where it rolls the enqueue
     * back with it), rather than escaping at commit time after the outbox row is already
     * considered written. Same reasoning as CoupleEmailOptOutAdapter.optOut.
     */
    @Override
    public void markSent(UUID vendorId) {
        jpaRepository.saveAndFlush(VendorListingNudgeSendEntity.builder()
                .vendorId(vendorId)
                .build());
    }
}
