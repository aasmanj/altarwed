package com.altarwed.application.service;

import com.altarwed.domain.exception.InvalidPromoCodeException;
import com.altarwed.domain.model.PlanTier;
import com.altarwed.domain.model.SubscriptionStatus;
import com.altarwed.domain.model.VendorSubscription;
import com.altarwed.domain.port.VendorSubscriptionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
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
 */
@Service
public class VendorPromoService {

    private static final Logger log = LoggerFactory.getLogger(VendorPromoService.class);

    private final VendorSubscriptionRepository subscriptionRepository;
    private final VendorService vendorService;
    private final String promoCode;

    public VendorPromoService(
            VendorSubscriptionRepository subscriptionRepository,
            VendorService vendorService,
            @Value("${altarwed.vendor.promo-code:}") String promoCode
    ) {
        this.subscriptionRepository = subscriptionRepository;
        this.vendorService = vendorService;
        this.promoCode = promoCode;
    }

    @Transactional
    public VendorSubscription redeem(UUID vendorId, String submittedCode) {
        if (promoCode == null || promoCode.isBlank()) {
            // Redemption disabled (no code configured). A client-facing 4xx, not a 500.
            log.warn("promo redemption attempted but no promo code configured, vendorId={}", vendorId);
            throw new InvalidPromoCodeException("Promo codes are not available right now.");
        }
        if (submittedCode == null || !submittedCode.trim().equalsIgnoreCase(promoCode.trim())) {
            // Never log the submitted or configured code; only the outcome + vendorId.
            log.warn("promo redemption rejected, invalid code, vendorId={}", vendorId);
            throw new InvalidPromoCodeException("That promo code is not valid.");
        }

        VendorSubscription existing = subscriptionRepository.findByVendorId(vendorId).orElse(null);

        // Idempotent and non-destructive: if the vendor has ANY Stripe-backed subscription (active,
        // past_due, cancelled, etc.), never overwrite it with a comp. Nulling the Stripe ids would
        // desync the Stripe webhooks, which resolve by stripe_subscription_id (so e.g. a later
        // subscription.deleted could no longer find the row and un-list them). Just ensure they are
        // listed and hand back what they have.
        if (existing != null && existing.stripeSubscriptionId() != null) {
            log.info("promo redemption noop, vendor already has a stripe subscription, vendorId={}", vendorId);
            vendorService.verify(vendorId);
            return existing;
        }

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
        log.info("vendor promo redeemed, comped subscription granted, vendorId={}", vendorId);
        return saved;
    }
}
