package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.port.EmailSuppressionPort;
import com.altarwed.infrastructure.persistence.entity.EmailSuppressionEntity;
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

    // Sources we recognise on the global table. USER_REQUEST is legacy only now (new
    // voluntary opt-outs are per-couple); BOUNCE/COMPLAINT are the address-level facts.
    private static final String SOURCE_USER_REQUEST = "USER_REQUEST";

    private final EmailSuppressionJpaRepository jpaRepository;
    // Append-only audit row written alongside every state change, in the same transaction.
    private final SubscriptionAuditRecorder audit;

    @Override
    public boolean isSuppressed(String emailHash) {
        return jpaRepository.existsByEmailHash(emailHash);
    }

    @Override
    public void suppress(String emailHash, String source) {
        if (jpaRepository.existsByEmailHash(emailHash)) {
            log.debug("email already globally suppressed, hash={}", emailHash);
            return;
        }
        try {
            jpaRepository.save(EmailSuppressionEntity.builder()
                    .emailHash(emailHash)
                    .source(source)
                    .build());
            audit.record(emailHash, null, SubscriptionAuditRecorder.ACTION_SUPPRESSED, source);
            log.info("email globally suppressed, source={}", source);
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
    public boolean clearLegacyUserRequest(String emailHash) {
        long removed = jpaRepository.deleteByEmailHashAndSource(emailHash, SOURCE_USER_REQUEST);
        if (removed > 0) {
            audit.record(emailHash, null, SubscriptionAuditRecorder.ACTION_RESUBSCRIBED, "GUEST_RSVP");
            log.info("legacy global unsubscribe cleared on resubscribe");
        }
        return removed > 0;
    }
}
