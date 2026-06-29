package com.altarwed.application.service;

import com.altarwed.domain.exception.InvalidPromoCodeException;
import com.altarwed.domain.model.PlanTier;
import com.altarwed.domain.model.SubscriptionStatus;
import com.altarwed.domain.model.VendorPromoCode;
import com.altarwed.domain.model.VendorPromoRedemption;
import com.altarwed.domain.model.VendorSubscription;
import com.altarwed.domain.port.VendorPromoCodeRepository;
import com.altarwed.domain.port.VendorSubscriptionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Comp-code redemption for vendors. A valid promo code grants a FREE listing equivalent to a paid
 * subscription, deliberately WITHOUT touching Stripe: comped vendors (the founder's friends and the
 * first vendors) must not have to enter a credit card. The grant reuses the exact publish path the
 * Stripe webhook uses (VendorService.verify), so a comped vendor appears in the public directory the
 * same way a paying one does.
 *
 * The "comped" state is represented as an ACTIVE VendorSubscription with NO Stripe ids (a paying sub
 * always has a stripeSubscriptionId from the webhook), so no schema change is needed to tell them
 * apart for reporting or UI.
 *
 * Codes are now DB-backed (vendor_promo_codes, migration V75): each code can carry a redemption cap
 * and an expiry, and every redemption is audited in vendor_promo_redemptions. While that table is
 * empty we fall back to the single env-var code (altarwed.vendor.promo-code) so existing deployments
 * keep working until the first admin-issued code is created. Codes themselves are NEVER logged; only
 * the code's UUID (codeId) is.
 */
@Service
public class VendorPromoService {

    private static final Logger log = LoggerFactory.getLogger(VendorPromoService.class);

    private final VendorSubscriptionRepository subscriptionRepository;
    private final VendorPromoCodeRepository promoCodeRepository;
    private final VendorService vendorService;
    private final String promoCode;

    public VendorPromoService(
            VendorSubscriptionRepository subscriptionRepository,
            VendorPromoCodeRepository promoCodeRepository,
            VendorService vendorService,
            @Value("${altarwed.vendor.promo-code:}") String promoCode
    ) {
        this.subscriptionRepository = subscriptionRepository;
        this.promoCodeRepository = promoCodeRepository;
        this.vendorService = vendorService;
        this.promoCode = promoCode;
    }

    @Transactional
    public VendorSubscription redeem(UUID vendorId, String submittedCode) {
        // 1. Validate the submitted code. Returns the matched DB code, or null on the env-var
        //    fallback path (empty table). Throws InvalidPromoCodeException on any rejection.
        VendorPromoCode dbCode = validateCode(vendorId, submittedCode);

        VendorSubscription existing = subscriptionRepository.findByVendorId(vendorId).orElse(null);

        // 2. Never overwrite a LIVE Stripe-backed subscription with a comp. Nulling the Stripe ids
        //    would desync the Stripe webhooks, which resolve by stripe_subscription_id (so e.g. a
        //    later subscription.deleted could no longer find the row and un-list them). A CANCELLED
        //    Stripe sub is NOT live (subscription.deleted already fired), so a comp is allowed to
        //    take it over and re-list the vendor as ACTIVE.
        boolean liveStripe = existing != null
                && existing.stripeSubscriptionId() != null
                && existing.status() != SubscriptionStatus.CANCELLED;
        if (liveStripe) {
            log.info("promo redemption noop, vendor already has a live stripe subscription, vendorId={}", vendorId);
            vendorService.verify(vendorId);
            return existing;
        }

        // 3. Grant (or refresh) the comp. Covers vendors with no sub, a PENDING sub, or a CANCELLED
        //    Stripe sub. The null Stripe ids are the "comped" marker, which also flips the dashboard
        //    to "comped" instead of the Upgrade panel.
        LocalDateTime now = LocalDateTime.now();
        VendorSubscription comped = new VendorSubscription(
                existing != null ? existing.id() : null,
                vendorId,
                PlanTier.FEATURED,          // comp grants the paid-equivalent tier
                SubscriptionStatus.ACTIVE,
                null,                       // no Stripe customer
                null,                       // no Stripe subscription -> the null id is the "comped" marker
                now,                        // currentPeriodStart
                null,                       // currentPeriodEnd null = perpetual comp (no renewal/billing)
                null,                       // cancelledAt
                existing != null ? existing.createdAt() : now,
                now
        );
        VendorSubscription saved = subscriptionRepository.save(comped);

        // Same publish path as the Stripe ACTIVE webhook: flips isVerified so the vendor appears in
        // findAllActive() (the public directory).
        vendorService.verify(vendorId);

        // 4. Record consumption only when a DB code was actually used (the env-var fallback has no
        //    row to increment). A live-Stripe noop never reaches here, so it never consumes a code.
        if (dbCode != null) {
            consume(dbCode, vendorId);
        }

        log.info("vendor promo redeemed, comped subscription granted, vendorId={}", vendorId);
        return saved;
    }

    /**
     * Issue a new DB-backed comp code. Admin-only; the caller (AdminPromoCodeController) enforces
     * the admin whitelist before this runs.
     */
    @Transactional
    public VendorPromoCode createPromoCode(String code, Integer maxRedemptions, OffsetDateTime expiresAt) {
        String normalized = code == null ? null : code.trim();
        if (normalized == null || normalized.isBlank()) {
            throw new InvalidPromoCodeException("Promo code is required.");
        }
        if (promoCodeRepository.findByCodeIgnoreCase(normalized).isPresent()) {
            // Codes are unique. Reject the duplicate before the DB constraint does, and never log
            // the code value itself.
            log.warn("promo code creation rejected, code already exists");
            throw new InvalidPromoCodeException("A promo code with that value already exists.");
        }
        OffsetDateTime now = OffsetDateTime.now();
        VendorPromoCode created = promoCodeRepository.save(new VendorPromoCode(
                null, normalized, maxRedemptions, expiresAt, 0, now, now
        ));
        log.info("vendor promo code created, codeId={}, maxRedemptions={}", created.id(), maxRedemptions);
        return created;
    }

    @Transactional(readOnly = true)
    public List<VendorPromoCode> listPromoCodes() {
        return promoCodeRepository.findAll();
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    private VendorPromoCode validateCode(UUID vendorId, String submittedCode) {
        if (submittedCode == null || submittedCode.isBlank()) {
            log.warn("promo redemption rejected, blank code, vendorId={}", vendorId);
            throw new InvalidPromoCodeException("That promo code is not valid.");
        }
        String trimmed = submittedCode.trim();

        // Backward compatibility: until the first DB code is issued, validate against the env-var
        // code so existing deployments keep working unchanged.
        if (promoCodeRepository.count() == 0) {
            validateEnvCode(vendorId, trimmed);
            return null;
        }

        VendorPromoCode code = promoCodeRepository.findByCodeIgnoreCase(trimmed).orElse(null);
        if (code == null) {
            log.warn("promo redemption rejected, invalid code, vendorId={}", vendorId);
            throw new InvalidPromoCodeException("That promo code is not valid.");
        }
        OffsetDateTime now = OffsetDateTime.now();
        if (code.expiresAt() != null && code.expiresAt().isBefore(now)) {
            log.warn("promo redemption rejected, expired code, codeId={}, vendorId={}", code.id(), vendorId);
            throw new InvalidPromoCodeException("That promo code has expired.");
        }
        if (code.maxRedemptions() != null && code.redeemedCount() >= code.maxRedemptions()) {
            log.warn("promo redemption rejected, code over cap, codeId={}, vendorId={}", code.id(), vendorId);
            throw new InvalidPromoCodeException("That promo code has reached its redemption limit.");
        }
        return code;
    }

    private void validateEnvCode(UUID vendorId, String trimmed) {
        if (promoCode == null || promoCode.isBlank()) {
            // Redemption disabled (no code configured and no DB codes). A client-facing 4xx, not a 500.
            log.warn("promo redemption attempted but no promo code configured, vendorId={}", vendorId);
            throw new InvalidPromoCodeException("Promo codes are not available right now.");
        }
        if (!trimmed.equalsIgnoreCase(promoCode.trim())) {
            // Never log the submitted or configured code; only the outcome + vendorId.
            log.warn("promo redemption rejected, invalid code, vendorId={}", vendorId);
            throw new InvalidPromoCodeException("That promo code is not valid.");
        }
    }

    private void consume(VendorPromoCode code, UUID vendorId) {
        OffsetDateTime now = OffsetDateTime.now();
        VendorPromoCode incremented = new VendorPromoCode(
                code.id(),
                code.code(),
                code.maxRedemptions(),
                code.expiresAt(),
                code.redeemedCount() + 1,
                code.createdAt(),
                now
        );
        promoCodeRepository.save(incremented);
        promoCodeRepository.saveRedemption(new VendorPromoRedemption(null, code.id(), vendorId, now));
        log.info("vendor promo code consumed, codeId={}, vendorId={}", code.id(), vendorId);
    }
}
