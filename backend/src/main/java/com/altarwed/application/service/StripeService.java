package com.altarwed.application.service;

import com.altarwed.domain.model.PlanTier;
import com.altarwed.domain.model.SubscriptionStatus;
import com.altarwed.domain.model.VendorSubscription;
import com.altarwed.domain.port.PrintOrderRepository;
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
import java.util.Optional;
import java.util.UUID;

@Service
public class StripeService {

    private static final Logger log = LoggerFactory.getLogger(StripeService.class);

    private final StripePort stripePort;
    private final VendorSubscriptionRepository subscriptionRepository;
    private final VendorService vendorService;
    private final PrintOrderRepository printOrderRepository;
    private final PrintOrderService printOrderService;
    private final String appBaseUrl;
    private final String priceProMonthly;
    private final String priceProAnnual;

    public StripeService(
            StripePort stripePort,
            VendorSubscriptionRepository subscriptionRepository,
            VendorService vendorService,
            PrintOrderRepository printOrderRepository,
            PrintOrderService printOrderService,
            @Value("${altarwed.app.base-url:https://app.altarwed.com}") String appBaseUrl,
            @Value("${altarwed.stripe.prices.pro-monthly:}") String priceProMonthly,
            @Value("${altarwed.stripe.prices.pro-annual:}") String priceProAnnual
    ) {
        this.stripePort = stripePort;
        this.subscriptionRepository = subscriptionRepository;
        this.vendorService = vendorService;
        this.printOrderRepository = printOrderRepository;
        this.printOrderService = printOrderService;
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
                    null, null, null, null, null, now, now, null
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

    // NOT @Transactional (issue #59/#53): the print-order cases below must commit their own
    // writes independently and immediately (see PrintOrderJpaAdapter's REQUIRES_NEW propagation)
    // before triggering the async Lob batch, so this method must not wrap them in one ambient
    // transaction that only commits at the very end. The subscription cases' own writes go
    // through subscriptionRepository.save(), whose default REQUIRED propagation means each call
    // still gets its own transaction here exactly as before (there is no longer an outer one to
    // join), so their atomicity is unchanged.
    public void handleWebhook(byte[] payload, String sigHeader) {
        StripeEventData event = stripePort.constructEvent(payload, sigHeader);
        switch (event.eventType()) {
            case "customer.subscription.created", "customer.subscription.updated" ->
                    handleSubscriptionUpsert(event);
            case "customer.subscription.deleted" ->
                    handleSubscriptionDeleted(event);
            case "invoice.payment_failed" ->
                    handleInvoicePaymentFailed(event);
            case "checkout.session.completed" ->
                    handlePrintOrderPaymentCompleted(event);
            case "checkout.session.expired" ->
                    handlePrintOrderPaymentExpired(event);
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
        LocalDateTime eventAt = toLocal(event.eventCreatedAt());

        LocalDateTime now = LocalDateTime.now();
        try {
            VendorSubscription existing = subscriptionRepository.findByVendorId(vendorId).orElse(null);
            if (existing != null && isStale(existing.lastStripeEventAt(), eventAt)) {
                log.warn("stale stripe subscription event ignored, vendorId={}, eventCreatedAt={}, lastAppliedAt={}",
                          vendorId, eventAt, existing.lastStripeEventAt());
                return;
            }
            VendorSubscription updated;
            if (existing == null) {
                updated = new VendorSubscription(
                        null, vendorId, planTier, status,
                        event.stripeCustomerId(), event.stripeSubscriptionId(),
                        periodStart, periodEnd, cancelledAt, now, now, eventAt
                );
            } else {
                updated = new VendorSubscription(
                        existing.id(), vendorId, planTier, status,
                        event.stripeCustomerId(), event.stripeSubscriptionId(),
                        periodStart, periodEnd, cancelledAt,
                        existing.createdAt(), now, eventAt
                );
            }
            subscriptionRepository.save(updated);
        } catch (DataIntegrityViolationException race) {
            // Concurrent webhook beat us to the INSERT -- fetch and overwrite with this event's data.
            VendorSubscription existing = subscriptionRepository.findByVendorId(vendorId)
                    .orElseThrow(() -> race);
            if (isStale(existing.lastStripeEventAt(), eventAt)) {
                log.warn("stale stripe subscription event ignored after concurrent insert, vendorId={}, eventCreatedAt={}, lastAppliedAt={}",
                          vendorId, eventAt, existing.lastStripeEventAt());
                return;
            }
            subscriptionRepository.save(new VendorSubscription(
                    existing.id(), vendorId, planTier, status,
                    event.stripeCustomerId(), event.stripeSubscriptionId(),
                    periodStart, periodEnd, cancelledAt,
                    existing.createdAt(), now, eventAt
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
        LocalDateTime eventAt = toLocal(event.eventCreatedAt());
        subscriptionRepository.findByStripeSubscriptionId(event.stripeSubscriptionId()).ifPresentOrElse(
                existing -> {
                    if (isStale(existing.lastStripeEventAt(), eventAt)) {
                        log.warn("stale stripe subscription.deleted event ignored, vendorId={}, eventCreatedAt={}, lastAppliedAt={}",
                                  existing.vendorId(), eventAt, existing.lastStripeEventAt());
                        return;
                    }
                    LocalDateTime now = LocalDateTime.now();
                    subscriptionRepository.save(new VendorSubscription(
                            existing.id(), existing.vendorId(), existing.planTier(),
                            SubscriptionStatus.CANCELLED,
                            existing.stripeCustomerId(), existing.stripeSubscriptionId(),
                            existing.currentPeriodStart(), existing.currentPeriodEnd(),
                            now, existing.createdAt(), now, eventAt
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
        LocalDateTime eventAt = toLocal(event.eventCreatedAt());
        subscriptionRepository.findByStripeSubscriptionId(event.stripeSubscriptionId()).ifPresentOrElse(
                existing -> {
                    if (isStale(existing.lastStripeEventAt(), eventAt)) {
                        log.warn("stale stripe invoice.payment_failed event ignored, vendorId={}, eventCreatedAt={}, lastAppliedAt={}",
                                  existing.vendorId(), eventAt, existing.lastStripeEventAt());
                        return;
                    }
                    LocalDateTime now = LocalDateTime.now();
                    subscriptionRepository.save(new VendorSubscription(
                            existing.id(), existing.vendorId(), existing.planTier(),
                            SubscriptionStatus.PAST_DUE,
                            existing.stripeCustomerId(), existing.stripeSubscriptionId(),
                            existing.currentPeriodStart(), existing.currentPeriodEnd(),
                            existing.cancelledAt(), existing.createdAt(), now, eventAt
                    ));
                    log.info("vendor subscription past_due, vendorId={}", existing.vendorId());
                },
                () -> log.warn("stripe invoice.payment_failed: no subscription found, stripeSubscriptionId={}",
                               event.stripeSubscriptionId())
        );
    }

    // Issue #59: fires once the couple actually completes payment on the hosted Checkout page.
    // Confirms the order, then triggers the async Lob batch (issue #53) -- see PrintOrderService
    // .submitBatchAsync and PrintOrderJpaAdapter's REQUIRES_NEW propagation for why
    // markPaymentConfirmed must durably commit before that trigger, and this whole method must not
    // run inside handleWebhook's (now removed) ambient transaction.
    private void handlePrintOrderPaymentCompleted(StripeEventData event) {
        if (event.printOrderId() == null) {
            log.warn("stripe checkout.session.completed missing printOrderId metadata, sessionId={}",
                     event.stripeCheckoutSessionId());
            return;
        }
        UUID orderId;
        try {
            orderId = UUID.fromString(event.printOrderId());
        } catch (IllegalArgumentException e) {
            log.warn("stripe checkout.session.completed has invalid printOrderId metadata, raw={}", event.printOrderId());
            return;
        }
        if (printOrderRepository.findById(orderId).isEmpty()) {
            log.warn("stripe checkout.session.completed: no print order found, orderId={}", orderId);
            return;
        }
        // Idempotency: Stripe redelivers webhooks at-least-once, and can deliver the same event
        // concurrently. This is a compare-and-swap (only transitions a row currently
        // PENDING_PAYMENT to PROCESSING) -- a plain "read status, then write" check-then-act would
        // let two concurrent deliveries both read PENDING_PAYMENT before either commits, both
        // transition, and both trigger the batch below (double-mail, double Lob charge). Only the
        // delivery that actually wins the atomic transition (returns true) may trigger it.
        boolean won = printOrderRepository.markPaymentConfirmed(orderId, event.stripePaymentIntentId());
        if (!won) {
            log.info("stripe checkout.session.completed ignored, order already confirmed, orderId={}", orderId);
            return;
        }
        log.info("print order payment confirmed, orderId={}", orderId);
        printOrderService.submitBatchAsync(orderId);
    }

    // Issue #59: fires if the couple abandons the hosted Checkout page (Stripe's 24h default
    // expiry). No charge was ever captured, so no Lob call happens and no refund is needed.
    private void handlePrintOrderPaymentExpired(StripeEventData event) {
        if (event.printOrderId() == null) {
            log.warn("stripe checkout.session.expired missing printOrderId metadata, sessionId={}",
                     event.stripeCheckoutSessionId());
            return;
        }
        UUID orderId;
        try {
            orderId = UUID.fromString(event.printOrderId());
        } catch (IllegalArgumentException e) {
            log.warn("stripe checkout.session.expired has invalid printOrderId metadata, raw={}", event.printOrderId());
            return;
        }
        if (printOrderRepository.findById(orderId).isEmpty()) {
            log.info("stripe checkout.session.expired ignored, order not found, orderId={}", orderId);
            return;
        }
        // Same compare-and-swap reasoning as handlePrintOrderPaymentCompleted above.
        boolean won = printOrderRepository.markPaymentFailed(orderId,
                "Payment was not completed before the checkout link expired.");
        if (!won) {
            log.info("stripe checkout.session.expired ignored, order already resolved, orderId={}", orderId);
            return;
        }
        log.info("print order payment expired, orderId={}", orderId);
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

    // #115: an incoming event is stale only if we've already applied a strictly later event to
    // this row. Ties are NOT stale (event.created is second-granularity, so two distinct events
    // in the same wall-clock second are possible; treating a tie as stale could drop a genuine
    // terminal subscription.deleted that lands in the same second as a prior update). A tied
    // redelivery of the identical event is idempotent to reapply, so "apply" is safe either way.
    // Comparable-but-missing timestamps (either side null -- a row never touched by a webhook, or
    // a legacy/test event with no `created`) are never treated as stale.
    private boolean isStale(LocalDateTime lastAppliedAt, LocalDateTime incomingEventAt) {
        return lastAppliedAt != null && incomingEventAt != null && incomingEventAt.isBefore(lastAppliedAt);
    }
}
