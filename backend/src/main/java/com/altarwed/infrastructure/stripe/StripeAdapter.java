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
            default -> new StripeEventData(eventType, null, null, null, null, null, null, null, null, eventCreatedAt);
        };
    }

    private StripeEventData extractSubscriptionEvent(Event event, String eventType, Instant eventCreatedAt) {
        var deserializer = event.getDataObjectDeserializer();
        if (deserializer.getObject().isEmpty()) {
            log.warn("stripe subscription event had no deserializable object, eventType={}", eventType);
            return new StripeEventData(eventType, null, null, null, null, null, null, null, null, eventCreatedAt);
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
                eventCreatedAt
        );
    }

    private StripeEventData extractInvoiceEvent(Event event, Instant eventCreatedAt) {
        var deserializer = event.getDataObjectDeserializer();
        if (deserializer.getObject().isEmpty()) {
            log.warn("stripe invoice event had no deserializable object");
            return new StripeEventData("invoice.payment_failed", null, null, null, null, null, null, null, null, eventCreatedAt);
        }
        Invoice invoice = (Invoice) deserializer.getObject().get();
        return new StripeEventData(
                "invoice.payment_failed",
                invoice.getSubscription(),
                invoice.getCustomer(),
                null, null, null, null, null, null,
                eventCreatedAt
        );
    }

    private void requireClient() {
        if (client == null) {
            throw new StripeCallException("Stripe secret-key is not configured");
        }
    }
}
