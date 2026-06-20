package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.port.CoupleEmailOptOutPort;
import com.altarwed.infrastructure.persistence.entity.CoupleEmailOptOutEntity;
import com.altarwed.infrastructure.persistence.repository.CoupleEmailOptOutJpaRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class CoupleEmailOptOutAdapter implements CoupleEmailOptOutPort {

    private static final Logger log = LoggerFactory.getLogger(CoupleEmailOptOutAdapter.class);

    private final CoupleEmailOptOutJpaRepository jpaRepository;
    private final SubscriptionAuditRecorder audit;

    @Override
    public boolean isOptedOut(UUID coupleId, String emailHash) {
        return jpaRepository.existsByCoupleIdAndEmailHash(coupleId, emailHash);
    }

    @Override
    public void optOut(UUID coupleId, String emailHash) {
        if (jpaRepository.existsByCoupleIdAndEmailHash(coupleId, emailHash)) {
            log.debug("guest already opted out for couple, coupleId={}", coupleId);
            return;
        }
        try {
            // saveAndFlush so a concurrent duplicate (couple, hash) insert raises the
            // unique violation here and is caught, rather than escaping to commit as a 500.
            jpaRepository.saveAndFlush(CoupleEmailOptOutEntity.builder()
                    .coupleId(coupleId)
                    .emailHash(emailHash)
                    .build());
            audit.record(emailHash, coupleId, SubscriptionAuditRecorder.ACTION_SUPPRESSED, "USER_REQUEST");
            log.info("guest unsubscribed from couple wedding mail, coupleId={}", coupleId);
        } catch (DataIntegrityViolationException ex) {
            // Concurrent insert on the same (couple, hash) -- idempotent, ignore.
            log.debug("couple opt-out concurrent insert ignored, coupleId={}", coupleId);
        }
    }

    @Override
    public boolean removeOptOut(UUID coupleId, String emailHash) {
        long removed = jpaRepository.deleteByCoupleIdAndEmailHash(coupleId, emailHash);
        if (removed > 0) {
            audit.record(emailHash, coupleId, SubscriptionAuditRecorder.ACTION_RESUBSCRIBED, "GUEST_RSVP");
            log.info("guest resubscribed to couple wedding mail, coupleId={}", coupleId);
        }
        return removed > 0;
    }

    @Override
    public Set<String> optedOutHashes(UUID coupleId, Collection<String> emailHashes) {
        if (emailHashes == null || emailHashes.isEmpty()) return Set.of();
        return jpaRepository.findByCoupleIdAndEmailHashIn(coupleId, emailHashes).stream()
                .map(CoupleEmailOptOutEntity::getEmailHash)
                .collect(Collectors.toSet());
    }
}
