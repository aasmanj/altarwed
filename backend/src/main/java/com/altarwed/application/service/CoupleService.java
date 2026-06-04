package com.altarwed.application.service;

import com.altarwed.domain.exception.CoupleNotFoundException;
import com.altarwed.domain.model.Couple;
import com.altarwed.domain.port.CeremonySectionRepository;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.GoogleOAuthTokenRepository;
import com.altarwed.domain.port.PasswordResetTokenRepository;
import com.altarwed.domain.port.PrintOrderRepository;
import com.altarwed.domain.port.RefreshTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

@Service
public class CoupleService {

    private static final Logger log = LoggerFactory.getLogger(CoupleService.class);

    private final CoupleRepository coupleRepository;
    private final PrintOrderRepository printOrderRepository;
    private final CeremonySectionRepository ceremonySectionRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final GoogleOAuthTokenRepository googleOAuthTokenRepository;
    private final AsyncEmailService asyncEmailService;

    public CoupleService(
            CoupleRepository coupleRepository,
            PrintOrderRepository printOrderRepository,
            CeremonySectionRepository ceremonySectionRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordResetTokenRepository passwordResetTokenRepository,
            GoogleOAuthTokenRepository googleOAuthTokenRepository,
            AsyncEmailService asyncEmailService) {
        this.coupleRepository = coupleRepository;
        this.printOrderRepository = printOrderRepository;
        this.ceremonySectionRepository = ceremonySectionRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.googleOAuthTokenRepository = googleOAuthTokenRepository;
        this.asyncEmailService = asyncEmailService;
    }

    @Transactional(readOnly = true)
    public Couple getById(UUID id) {
        return coupleRepository.findById(id)
                .orElseThrow(() -> new CoupleNotFoundException(id));
    }

    @Transactional
    public Couple updateWeddingDate(UUID id, LocalDate weddingDate) {
        Couple couple = getById(id);
        Couple saved = coupleRepository.save(couple.withWeddingDate(weddingDate));
        log.info("couple wedding date updated, coupleId={}, newDate={}", id, weddingDate);
        return saved;
    }

    @Transactional
    public Couple updateDenomination(UUID id, UUID denominationId) {
        Couple couple = getById(id);
        Couple saved = coupleRepository.save(couple.withDenomination(denominationId));
        log.info("couple denomination updated, coupleId={}, denominationId={}", id, denominationId);
        return saved;
    }

    @Transactional
    public void deactivate(UUID id) {
        Couple couple = getById(id);
        coupleRepository.save(couple.deactivated());
        log.info("couple deactivated, coupleId={}", id);
    }

    @Transactional
    public void deleteAccount(UUID coupleId) {
        Couple couple = getById(coupleId);
        log.info("couple account deletion started, coupleId={}", coupleId);

        // Delete tables without ON DELETE CASCADE first, in FK-safe order.
        // 1. print_orders (DB cascades print_order_recipients via ON DELETE CASCADE)
        printOrderRepository.deleteAllByCoupleId(coupleId);
        // 2. ceremony_sections (no cascade from couples table)
        ceremonySectionRepository.deleteAllByCoupleId(coupleId);
        // 3. google_oauth_tokens (no FK at all in V35 -- live Google refresh token
        //    would be orphaned and remain usable if not explicitly deleted)
        googleOAuthTokenRepository.deleteByCoupleId(coupleId);
        // 4. refresh_tokens (no FK, user_id is a plain UUID column)
        refreshTokenRepository.deleteAllByUserId(coupleId);
        // 5. password_reset_tokens (keyed by email, no FK to couples)
        passwordResetTokenRepository.deleteAllByEmail(couple.email());
        // 6. Delete the couple -- DB cascades the rest:
        //    wedding_websites -> wedding_party_members, wedding_photos, wedding_prayers,
        //    wedding_page_blocks, wedding_hotels; guests -> rsvp_invite_tokens;
        //    planning_tasks, budget_items, seating_tables, google_sheet_syncs.
        coupleRepository.deleteById(coupleId);

        log.info("couple account deleted, coupleId={}", coupleId);

        // Confirmation email is fire-and-forget on its own thread, using the data
        // captured before the delete (the row is gone now). It fires inside the tx
        // for consistency with the rest of the codebase; the only failure window is
        // a commit failure after deleteById, which is negligible. If that ever
        // matters, upgrade to a @TransactionalEventListener(AFTER_COMMIT).
        asyncEmailService.sendAccountDeletedEmail(
                couple.email(), couple.partnerOneName(), couple.partnerTwoName());
        log.info("account-deleted email queued, coupleId={}", coupleId);
    }
}
