package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.port.EmailSuppressionPort;
import com.altarwed.infrastructure.persistence.entity.EmailSubscriptionEventEntity;
import com.altarwed.infrastructure.persistence.entity.EmailSuppressionEntity;
import com.altarwed.infrastructure.persistence.repository.EmailSubscriptionEventJpaRepository;
import com.altarwed.infrastructure.persistence.repository.EmailSuppressionJpaRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class EmailSuppressionAdapter implements EmailSuppressionPort {

    private static final Logger log = LoggerFactory.getLogger(EmailSuppressionAdapter.class);

    private static final String ACTION_SUPPRESSED = "SUPPRESSED";
    private static final String ACTION_RESUBSCRIBED = "RESUBSCRIBED";

    private final EmailSuppressionJpaRepository jpaRepository;
    // Append-only audit log written alongside every state change. Both writes share the
    // caller's transaction, so the live state and its audit row commit atomically.
    private final EmailSubscriptionEventJpaRepository eventRepository;

    @Override
    public boolean isSuppressed(String emailHash) {
        return jpaRepository.existsByEmailHash(emailHash);
    }

    @Override
    public void suppress(String emailHash, String source) {
        if (jpaRepository.existsByEmailHash(emailHash)) {
            log.debug("email already suppressed, hash={}", emailHash);
            return;
        }
        try {
            jpaRepository.save(EmailSuppressionEntity.builder()
                    .emailHash(emailHash)
                    .source(source)
                    .build());
            recordEvent(emailHash, ACTION_SUPPRESSED, source);
            log.info("email suppressed, source={}", source);
        } catch (DataIntegrityViolationException ex) {
            // Concurrent insert on the same hash -- idempotent, ignore (no audit row:
            // the address was already suppressed, so no new state change occurred).
            log.debug("email suppression concurrent insert ignored, hash={}", emailHash);
        }
    }

    @Override
    public Optional<String> suppressionSource(String emailHash) {
        return jpaRepository.findByEmailHash(emailHash).map(EmailSuppressionEntity::getSource);
    }

    @Override
    public Map<String, String> suppressionSources(Collection<String> emailHashes) {
        if (emailHashes == null || emailHashes.isEmpty()) return Map.of();
        return jpaRepository.findByEmailHashIn(emailHashes).stream()
                .collect(Collectors.toMap(
                        EmailSuppressionEntity::getEmailHash,
                        EmailSuppressionEntity::getSource,
                        (first, ignored) -> first));
    }

    @Override
    public boolean unsuppress(String emailHash, String source) {
        long removed = jpaRepository.deleteByEmailHash(emailHash);
        // Only audit a reversal that actually changed state; resubscribing an address
        // that was not suppressed is a no-op and writes no row.
        if (removed > 0) {
            recordEvent(emailHash, ACTION_RESUBSCRIBED, source);
        }
        // Source/coupleId context lives with the caller (resubscribe service), so keep
        // this low-level removal at DEBUG to avoid a duplicate INFO for one action.
        log.debug("email unsuppress attempted, removed={}", removed);
        return removed > 0;
    }

    private void recordEvent(String emailHash, String action, String source) {
        eventRepository.save(EmailSubscriptionEventEntity.builder()
                .emailHash(emailHash)
                .action(action)
                .source(source)
                .build());
    }
}
