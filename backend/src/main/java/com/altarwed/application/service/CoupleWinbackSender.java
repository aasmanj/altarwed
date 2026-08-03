package com.altarwed.application.service;

import com.altarwed.domain.model.Couple;
import com.altarwed.domain.model.email.CoupleWinbackTouch;
import com.altarwed.domain.port.CoupleWinbackTouchRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * The per-couple transactional unit of the couple win-back sequence (issue #551).
 *
 * Deliberately a SEPARATE bean from {@link CoupleWinbackService}: the send-once ledger row and the
 * outbox enqueue must commit together (so a recorded touch was always queued, and a queued touch
 * was always recorded), while one couple failing must NOT roll back the rest of the batch. That is
 * the same split {@link CampaignReminderSender} uses: a self-invocation of an @Transactional method
 * on the scheduler bean would bypass the Spring proxy and lose the per-couple boundary, so the
 * transactional work lives here where the scheduler reaches it through a real proxy.
 *
 * recordSent runs before the enqueue so the unique (couple_id, touch) constraint is the hard
 * dedupe: if two instances (or a retry) race to send the same touch, one insert wins and the other
 * throws a constraint violation that rolls back this whole unit, leaving no second outbox row. The
 * scheduler catches that per-couple failure and moves on.
 */
@Service
public class CoupleWinbackSender {

    private final AsyncEmailService asyncEmailService;
    private final CoupleWinbackTouchRepository touchRepository;

    public CoupleWinbackSender(AsyncEmailService asyncEmailService,
                               CoupleWinbackTouchRepository touchRepository) {
        this.asyncEmailService = asyncEmailService;
        this.touchRepository = touchRepository;
    }

    @Transactional
    public void sendTouch(Couple couple, CoupleWinbackTouch touch) {
        // Record first: the unique-constraint insert is what makes a concurrent double-send
        // impossible. If it violates, the enqueue below never commits.
        touchRepository.recordSent(couple.id(), touch, LocalDateTime.now());
        asyncEmailService.sendCoupleWinbackEmail(
                couple.email(), couple.partnerOneName(), couple.partnerTwoName(), touch);
    }
}
