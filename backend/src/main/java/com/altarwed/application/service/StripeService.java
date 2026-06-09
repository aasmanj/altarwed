package com.altarwed.application.service;

import com.altarwed.domain.model.PlanTier;
import com.altarwed.domain.model.SubscriptionStatus;
import com.altarwed.domain.model.VendorSubscription;
import com.altarwed.domain.port.StripePort;
import com.altarwed.domain.port.StripePort.StripeEventData;
import com.altarwed.domain.port.VendorSubscriptionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Service
public class StripeService {

    private static final Logger log = LoggerFactory.getLogger(StripeService.class);

    private final StripePort stripePort;
    private final VendorSubscriptionRepository subscriptionRepository;
    private final VendorService vendorService;
    private final String appBaseUrl;
    private final String priceProMonthly;
    private final String priceProAnnual;

    public StripeService(
            StripePort stripePort,
            VendorSubscriptionRepository subscriptionRepository,
            VendorService vendorService,
            @Value("${altarwed.app.base-url:https://app.altarwed.com}") String appBaseUrl,
            @Value("${altarwed.stripe.prices.pro-monthly:}") String priceProMonthly,
            @Value("${altarwed.stripe.prices.pro-annual:}") String priceProAnnual
    ) {
        this.stripePort = stripePort;
        this.subscriptionRepository = subscriptionRepository;
        this.vendorService = vendorService;
        this.appBaseUrl = appBaseUrl;
        this.priceProMonthly = priceProMonthly;
        this.priceProAnnual = priceProAnnual;
    }

    @Transactional
    public String createCheckoutSession(UUID vendorId, String vendorEmail, String priceId) {
        subscriptionRepository.findByVendorId(vendorId).orElseGet(() -> {
            LocalDateTime now = LocalDateTime.now();
            return subscriptionRepository.save(new VendorSubscription(
                    null, vendorId, PlanTier.BASIC, SubscriptionStatus.PENDING,
                    null, null, null, null, null, now, now
            ));
        });
        String successUrl = appBaseUrl + "/vendor/subscription?session=success";
        String cancelUrl = appBaseUrl + "/vendor/subscription";
        log.info("stripe checkout session requested, vendorId={}, priceId={}", vendorId, priceId);
        String url = stripePort.createCheckoutSession(vendorId, vendorEmail, priceId, successUrl, cancelUrl);
        log.info("stripe checkout session ready, vendorId={}", vendorId);
        return url;
    }

    @Transactional(readOnly = true)
    public String createPortalSession(UUID vendorId) {
        VendorSubscription sub = subscriptionRepository.findByVendorId(vendorId)
                .filter(s -> s.stripeCustomerId() != null)
                .orElseThrow(() -> new IllegalStateException("No active Stripe customer for vendor"));
        String returnUrl = appBaseUrl + "/vendor/subscription";
        log.info("stripe portal session requested, vendorId={}", vendorId);
        return stripePort.createPortalSession(sub.stripeCustomerId(), returnUrl);
    }

    @Transactional
    public void handleWebhook(byte[] payload, String sigHeader) {
        StripeEventData event = stripePort.constructEvent(payload, sigHeader);
        switch (event.eventType()) {
            case "customer.subscription.created", "customer.subscription.updated" ->
                    handleSubscriptionUpsert(event);
            case "customer.subscription.deleted" ->
                    handleSubscriptionDeleted(event);
            case "invoice.payment_failed" ->
                    handleInvoicePaymentFailed(event);
            default ->
                    log.debug("stripe webhook ignored, eventType={}", event.eventType());
        }
    }

    @Transactional(readOnly = true)
    public VendorSubscription getSubscription(UUID vendorId) {
        return subscriptionRepository.findByVendorId(vendorId).orElse(null);
    }

    public String getPriceProMonthly() { return priceProMonthly; }
    public String getPriceProAnnual()  { return priceProAnnual; }

    // -------------------------------------------------------------------------
    // Webhook handlers
    // -------------------------------------------------------------------------

    private void handleSubscriptionUpsert(StripeEventData event) {
        if (event.vendorId() == null) {
            log.warn("stripe subscription event missing vendorId metadata, stripeSubscriptionId={}",
                     event.stripeSubscriptionId());
            return;
        }
        UUID vendorId;
        try {
            vendorId = UUID.fromString(event.vendorId());
        } catch (IllegalArgumentException e) {
            log.warn("stripe subscription event has invalid vendorId metadata, raw={}", event.vendorId());
            return;
        }

        PlanTier planTier = planTierFromPriceId(event.priceId());
        SubscriptionStatus status = statusFromStripe(event.stripeStatus());
        LocalDateTime periodStart = toLocal(event.currentPeriodStart());
        LocalDateTime periodEnd = toLocal(event.currentPeriodEnd());
        LocalDateTime cancelledAt = toLocal(event.cancelledAt());

        LocalDateTime now = LocalDateTime.now();
        try {
            VendorSubscription existing = subscriptionRepository.findByVendorId(vendorId).orElse(null);
            VendorSubscription updated;
            if (existing == null) {
                updated = new VendorSubscription(
                        null, vendorId, planTier, status,
                        event.stripeCustomerId(), event.stripeSubscriptionId(),
                        periodStart, periodEnd, cancelledAt, now, now
                );
            } else {
                updated = new VendorSubscription(
                        existing.id(), vendorId, planTier, status,
                        event.stripeCustomerId(), event.stripeSubscriptionId(),
                        periodStart, periodEnd, cancelledAt,
                        existing.createdAt(), now
                );
            }
            subscriptionRepository.save(updated);
        } catch (DataIntegrityViolationException race) {
            // Concurrent webhook beat us to the INSERT -- fetch and overwrite with this event's data.
            VendorSubscription existing = subscriptionRepository.findByVendorId(vendorId)
                    .orElseThrow(() -> race);
            subscriptionRepository.save(new VendorSubscription(
                    existing.id(), vendorId, planTier, status,
                    event.stripeCustomerId(), event.stripeSubscriptionId(),
                    periodStart, periodEnd, cancelledAt,
                    existing.createdAt(), now
            ));
            log.warn("vendor subscription concurrent insert resolved, vendorId={}", vendorId);
        }
        log.info("vendor subscription upserted, vendorId={}, status={}, planTier={}", vendorId, status, planTier);

        if (status == SubscriptionStatus.ACTIVE || status == SubscriptionStatus.TRIALING) {
            try {
                vendorService.verify(vendorId);
                log.info("vendor verified via stripe subscription, vendorId={}", vendorId);
            } catch (Exception ex) {
                log.warn("vendor verify failed after subscription upsert, vendorId={}", vendorId, ex);
            }
        }
    }

    private void handleSubscriptionDeleted(StripeEventData event) {
        if (event.stripeSubscriptionId() == null) {
            log.warn("stripe subscription.deleted event missing subscription id");
            return;
        }
        subscriptionRepository.findByStripeSubscriptionId(event.stripeSubscriptionId()).ifPresentOrElse(
                existing -> {
                    LocalDateTime now = LocalDateTime.now();
                    subscriptionRepository.save(new VendorSubscription(
                            existing.id(), existing.vendorId(), existing.planTier(),
                            SubscriptionStatus.CANCELLED,
                            existing.stripeCustomerId(), existing.stripeSubscriptionId(),
                            existing.currentPeriodStart(), existing.currentPeriodEnd(),
                            now, existing.createdAt(), now
                    ));
                    log.info("vendor subscription cancelled, vendorId={}", existing.vendorId());
                    try {
                        vendorService.unverify(existing.vendorId());
                        log.info("vendor unlisted after subscription cancellation, vendorId={}", existing.vendorId());
                    } catch (Exception ex) {
                        log.warn("vendor unverify failed after subscription cancellation, vendorId={}", existing.vendorId(), ex);
                    }
                },
                () -> log.warn("stripe subscription.deleted: no subscription found, stripeSubscriptionId={}",
                               event.stripeSubscriptionId())
        );
    }

    private void handleInvoicePaymentFailed(StripeEventData event) {
        if (event.stripeSubscriptionId() == null) {
            log.warn("stripe invoice.payment_failed event missing subscription id");
            return;
        }
        subscriptionRepository.findByStripeSubscriptionId(event.stripeSubscriptionId()).ifPresentOrElse(
                existing -> {
                    LocalDateTime now = LocalDateTime.now();
                    subscriptionRepository.save(new VendorSubscription(
                            existing.id(), existing.vendorId(), existing.planTier(),
                            SubscriptionStatus.PAST_DUE,
                            existing.stripeCustomerId(), existing.stripeSubscriptionId(),
                            existing.currentPeriodStart(), existing.currentPeriodEnd(),
                            existing.cancelledAt(), existing.createdAt(), now
                    ));
                    log.info("vendor subscription past_due, vendorId={}", existing.vendorId());
                },
                () -> log.warn("stripe invoice.payment_failed: no subscription found, stripeSubscriptionId={}",
                               event.stripeSubscriptionId())
        );
    }

    // -------------------------------------------------------------------------
    // Mapping helpers
    // -------------------------------------------------------------------------

    private PlanTier planTierFromPriceId(String priceId) {
        if (priceId == null || priceId.isBlank()) return PlanTier.BASIC;
        if (!priceProMonthly.isBlank() && priceId.equals(priceProMonthly)) return PlanTier.FEATURED;
        if (!priceProAnnual.isBlank() && priceId.equals(priceProAnnual)) return PlanTier.FEATURED;
        return PlanTier.BASIC;
    }

    private SubscriptionStatus statusFromStripe(String stripeStatus) {
        if (stripeStatus == null) return SubscriptionStatus.PENDING;
        return switch (stripeStatus) {
            case "active"              -> SubscriptionStatus.ACTIVE;
            case "trialing"            -> SubscriptionStatus.TRIALING;
            case "past_due"            -> SubscriptionStatus.PAST_DUE;
            case "canceled", "cancelled" -> SubscriptionStatus.CANCELLED;
            default                    -> SubscriptionStatus.PENDING;
        };
    }

    private LocalDateTime toLocal(Instant instant) {
        return instant != null ? LocalDateTime.ofInstant(instant, ZoneOffset.UTC) : null;
    }
}
