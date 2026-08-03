package com.altarwed.application.service;

import com.altarwed.domain.model.email.CoupleWinbackCandidate;
import com.altarwed.domain.model.email.CoupleWinbackTouch;
import com.altarwed.domain.port.CoupleWinbackRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * The per-couple transactional unit of the win-back sequence (issue #551).
 *
 * Deliberately a SEPARATE bean from {@link CoupleWinbackService}, for the same reason
 * {@link CampaignReminderSender} is separate from {@link CampaignReminderService}: the outbox
 * enqueue and the send-once marker must commit together (a queued nudge is always recorded, and a
 * recorded nudge was always queued), while one couple's failure must NOT roll back the rest of the
 * batch. A self-invocation of an {@code @Transactional} method on the scheduler bean would bypass
 * the Spring proxy and quietly lose that per-couple boundary, so the transactional work lives here
 * where the scheduler reaches it through a real proxy.
 *
 * Ordering inside the transaction matters: the marker insert goes last, so a unique-constraint
 * violation from a concurrent duplicate (two instances racing past the ShedLock, a replayed run)
 * rolls the enqueue back with it rather than leaving a second nudge in the outbox.
 */
@Service
public class CoupleWinbackSender {

    private final AsyncEmailService asyncEmailService;
    private final CoupleWinbackRepository winbackRepository;

    public CoupleWinbackSender(AsyncEmailService asyncEmailService,
                               CoupleWinbackRepository winbackRepository) {
        this.asyncEmailService = asyncEmailService;
        this.winbackRepository = winbackRepository;
    }

    @Transactional
    public void send(CoupleWinbackCandidate candidate, CoupleWinbackTouch touch) {
        asyncEmailService.sendCoupleWinbackEmail(
                candidate.email(), candidate.partnerOneName(), candidate.partnerTwoName(), touch);
        winbackRepository.recordSent(candidate.coupleId(), touch, LocalDateTime.now());
    }
}
