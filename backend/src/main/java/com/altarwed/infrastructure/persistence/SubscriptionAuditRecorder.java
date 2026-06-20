package com.altarwed.infrastructure.persistence;

import com.altarwed.infrastructure.persistence.entity.EmailSubscriptionEventEntity;
import com.altarwed.infrastructure.persistence.repository.EmailSubscriptionEventJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Writes one immutable row to the append-only email_subscription_event audit trail for
 * each subscription state change. Shared by both suppression adapters (global and
 * per-couple) so the audit logic lives in one place. The write happens inside the
 * caller's transaction, so the live-state change and its audit row commit atomically.
 */
@Component
@RequiredArgsConstructor
public class SubscriptionAuditRecorder {

    public static final String ACTION_SUPPRESSED = "SUPPRESSED";
    public static final String ACTION_RESUBSCRIBED = "RESUBSCRIBED";

    private final EmailSubscriptionEventJpaRepository eventRepository;

    /** coupleId is null for a global, address-level event (bounce/complaint). */
    public void record(String emailHash, UUID coupleId, String action, String source) {
        eventRepository.save(EmailSubscriptionEventEntity.builder()
                .emailHash(emailHash)
                .coupleId(coupleId)
                .action(action)
                .source(source)
                .build());
    }
}
