package com.altarwed.infrastructure.stripe;

import com.altarwed.domain.port.StripePort;
import com.stripe.StripeClient;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.Invoice;
import com.stripe.model.Subscription;
import com.stripe.net.Webhook;
import com.stripe.param.checkout.SessionCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Component
public class StripeAdapter implements StripePort {

    private static final Logger log = LoggerFactory.getLogger(StripeAdapter.class);

    private final String webhookSecret;
    private final StripeClient client;

    public StripeAdapter(
            @Value("${altarwed.stripe.secret-key:}") String secretKey,
            @Value("${altarwed.stripe.webhook-secret:}") String webhookSecret
    ) {
        this.webhookSecret = webhookSecret;
        if (secretKey == null || secretKey.isBlank()) {
            log.warn("stripe secret-key is not configured; billing features will fail at runtime");
            this.client = null;
        } else {
            this.client = new StripeClient(secretKey);
        }
    }

    @Override
    public String createCheckoutSession(UUID vendorId, String vendorEmail, String priceId,
                                        String successUrl, String cancelUrl) {
        requireClient();
        log.info("stripe checkout session creating, vendorId={}, priceId={}", vendorId, priceId);
        try {
            SessionCreateParams params = SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                    .setCustomerEmail(vendorEmail)
                    .addLineItem(SessionCreateParams.LineItem.builder()
                            .setPrice(priceId)
                            .setQuantity(1L)
                            .build())
                    .setSuccessUrl(successUrl)
                    .setCancelUrl(cancelUrl)
                    .setAllowPromotionCodes(true)
                    .setSubscriptionData(SessionCreateParams.SubscriptionData.builder()
                            .putMetadata("vendorId", vendorId.toString())
                            .build())
                    .build();
            com.stripe.model.checkout.Session session = client.checkout().sessions().create(params);
            log.info("stripe checkout session created, sessionId={}, vendorId={}", session.getId(), vendorId);
            return session.getUrl();
        } catch (com.stripe.exception.StripeException e) {
            log.error("stripe checkout session failed, vendorId={}", vendorId, e);
            throw new StripeCallException("Failed to create Stripe checkout session", e);
        }
    }

    @Override
    public CheckoutSession createOneTimeCheckoutSession(UUID printOrderId, String coupleEmail, long amountCents,
                                                        String description, String successUrl, String cancelUrl) {
        requireClient();
        log.info("stripe one-time checkout session creating, printOrderId={}, amountCents={}", printOrderId, amountCents);
        try {
            SessionCreateParams params = SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.PAYMENT)
                    .setCustomerEmail(coupleEmail)
                    .addLineItem(SessionCreateParams.LineItem.builder()
                            .setQuantity(1L)
                            .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                                    .setCurrency("usd")
                                    .setUnitAmount(amountCents)
                                    .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                            .setName(description)
                                            .build())
                                    .build())
                            .build())
                    .setSuccessUrl(successUrl)
                    .setCancelUrl(cancelUrl)
                    .putMetadata("printOrderId", printOrderId.toString())
                    .build();
            com.stripe.model.checkout.Session session = client.checkout().sessions().create(params);
            log.info("stripe one-time checkout session created, sessionId={}, printOrderId={}", session.getId(), printOrderId);
            return new CheckoutSession(session.getId(), session.getUrl());
        } catch (com.stripe.exception.StripeException e) {
            log.error("stripe one-time checkout session failed, printOrderId={}", printOrderId, e);
            throw new StripeCallException("Failed to create Stripe checkout session", e);
        }
    }

    @Override
    public void refundPayment(String paymentIntentId, long amountCents, String idempotencyKey) {
        requireClient();
        log.info("stripe refund creating, paymentIntentId={}, amountCents={}", paymentIntentId, amountCents);
        try {
            com.stripe.param.RefundCreateParams params = com.stripe.param.RefundCreateParams.builder()
                    .setPaymentIntent(paymentIntentId)
                    .setAmount(amountCents)
                    .build();
            // Deterministic idempotency key (see StripePort javadoc): if this ever runs twice for
            // the same logical refund, Stripe returns the original refund instead of a new one.
            com.stripe.net.RequestOptions options = com.stripe.net.RequestOptions.builder()
                    .setIdempotencyKey(idempotencyKey)
                    .build();
            com.stripe.model.Refund refund = client.refunds().create(params, options);
            log.info("stripe refund created, refundId={}, paymentIntentId={}", refund.getId(), paymentIntentId);
        } catch (com.stripe.exception.StripeException e) {
            log.error("stripe refund failed, paymentIntentId={}", paymentIntentId, e);
            throw new StripeCallException("Failed to create Stripe refund", e);
        }
    }

    @Override
    public String createPortalSession(String stripeCustomerId, String returnUrl) {
        requireClient();
        log.info("stripe portal session creating, stripeCustomerId={}", stripeCustomerId);
        try {
            com.stripe.param.billingportal.SessionCreateParams params =
                    com.stripe.param.billingportal.SessionCreateParams.builder()
                            .setCustomer(stripeCustomerId)
                            .setReturnUrl(returnUrl)
                            .build();
            com.stripe.model.billingportal.Session portal = client.billingPortal().sessions().create(params);
            log.info("stripe portal session created, stripeCustomerId={}", stripeCustomerId);
            return portal.getUrl();
        } catch (com.stripe.exception.StripeException e) {
            log.error("stripe portal session failed, stripeCustomerId={}", stripeCustomerId, e);
            throw new StripeCallException("Failed to create Stripe portal session", e);
        }
    }

    @Override
    public StripeEventData constructEvent(byte[] payload, String sigHeader) {
        if (webhookSecret == null || webhookSecret.isBlank()) {
            throw new StripeCallException("Stripe webhook-secret is not configured");
        }
        String payloadStr = new String(payload, StandardCharsets.UTF_8);
        Event event;
        try {
            event = Webhook.constructEvent(payloadStr, sigHeader, webhookSecret);
        } catch (SignatureVerificationException e) {
            log.warn("stripe webhook signature verification failed", e);
            throw new StripeCallException("Invalid Stripe webhook signature", e);
        }

        String eventType = event.getType();
        log.info("stripe webhook event received, eventType={}", eventType);
        Instant eventCreatedAt = event.getCreated() != null
                ? Instant.ofEpochSecond(event.getCreated()) : null;

        return switch (eventType) {
            case "customer.subscription.created", "customer.subscription.updated",
                 "customer.subscription.deleted" -> extractSubscriptionEvent(event, eventType, eventCreatedAt);
            case "invoice.payment_failed" -> extractInvoiceEvent(event, eventCreatedAt);
            case "checkout.session.completed", "checkout.session.expired" -> extractCheckoutSessionEvent(event, eventType, eventCreatedAt);
            default -> emptyEvent(eventType, eventCreatedAt);
        };
    }

    private static StripeEventData emptyEvent(String eventType, Instant eventCreatedAt) {
        return new StripeEventData(eventType, null, null, null, null, null, null, null, null,
                eventCreatedAt, null, null, null, null);
    }

    private StripeEventData extractSubscriptionEvent(Event event, String eventType, Instant eventCreatedAt) {
        var deserializer = event.getDataObjectDeserializer();
        if (deserializer.getObject().isEmpty()) {
            log.warn("stripe subscription event had no deserializable object, eventType={}", eventType);
            return emptyEvent(eventType, eventCreatedAt);
        }
        Subscription sub = (Subscription) deserializer.getObject().get();

        String vendorId = sub.getMetadata() != null ? sub.getMetadata().get("vendorId") : null;
        String priceId = null;
        List<com.stripe.model.SubscriptionItem> items =
                sub.getItems() != null ? sub.getItems().getData() : null;
        if (items != null && !items.isEmpty() && items.get(0).getPrice() != null) {
            priceId = items.get(0).getPrice().getId();
        }

        Instant periodStart = sub.getCurrentPeriodStart() != null
                ? Instant.ofEpochSecond(sub.getCurrentPeriodStart()) : null;
        Instant periodEnd = sub.getCurrentPeriodEnd() != null
                ? Instant.ofEpochSecond(sub.getCurrentPeriodEnd()) : null;
        Instant cancelledAt = sub.getCanceledAt() != null
                ? Instant.ofEpochSecond(sub.getCanceledAt()) : null;

        return new StripeEventData(
                eventType,
                sub.getId(),
                sub.getCustomer(),
                vendorId,
                priceId,
                sub.getStatus(),
                periodStart,
                periodEnd,
                cancelledAt,
                eventCreatedAt,
                null, null, null, null
        );
    }

    private StripeEventData extractInvoiceEvent(Event event, Instant eventCreatedAt) {
        var deserializer = event.getDataObjectDeserializer();
        if (deserializer.getObject().isEmpty()) {
            log.warn("stripe invoice event had no deserializable object");
            return emptyEvent("invoice.payment_failed", eventCreatedAt);
        }
        Invoice invoice = (Invoice) deserializer.getObject().get();
        return new StripeEventData(
                "invoice.payment_failed",
                invoice.getSubscription(),
                invoice.getCustomer(),
                null, null, null, null, null, null,
                eventCreatedAt,
                null, null, null, null
        );
    }

    // Issue #59: checkout.session.completed fires once the couple actually pays (payment_intent
    // is only populated at that point); checkout.session.expired fires if they abandon the
    // hosted page (Stripe's 24h default), payment_intent stays null. printOrderId rides in
    // session metadata, set when the session was created (createOneTimeCheckoutSession below).
    private StripeEventData extractCheckoutSessionEvent(Event event, String eventType, Instant eventCreatedAt) {
        var deserializer = event.getDataObjectDeserializer();
        if (deserializer.getObject().isEmpty()) {
            log.warn("stripe checkout session event had no deserializable object, eventType={}", eventType);
            return emptyEvent(eventType, eventCreatedAt);
        }
        com.stripe.model.checkout.Session session = (com.stripe.model.checkout.Session) deserializer.getObject().get();
        String printOrderId = session.getMetadata() != null ? session.getMetadata().get("printOrderId") : null;
        return new StripeEventData(
                eventType, null, null, null, null, null, null, null, null,
                eventCreatedAt,
                session.getId(),
                session.getPaymentIntent(),
                printOrderId,
                session.getAmountTotal()
        );
    }

    private void requireClient() {
        if (client == null) {
            throw new StripeCallException("Stripe secret-key is not configured");
        }
    }
}
