package com.altarwed.application.service;

import com.altarwed.domain.exception.InvalidPriceIdException;
import com.altarwed.domain.model.PlanTier;
import com.altarwed.domain.model.PrintOrder;
import com.altarwed.domain.model.PrintOrderStatus;
import com.altarwed.domain.model.PrintOrderType;
import com.altarwed.domain.model.SubscriptionStatus;
import com.altarwed.domain.model.VendorSubscription;
import com.altarwed.domain.port.PrintOrderRepository;
import com.altarwed.domain.port.StripePort;
import com.altarwed.domain.port.StripePort.StripeEventData;
import com.altarwed.domain.port.VendorSubscriptionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Mockito, no Spring context, per backend/CLAUDE.md's application/service testing convention.
 *
 * Two independent concerns share this service, so this file has two independent test groups:
 *   - #115: a delayed/out-of-order Stripe webhook must never overwrite state that a later event
 *     already applied (subscription create/update/delete, invoice payment_failed).
 *   - Issue #59/#53: checkout.session.completed/expired for a couple's print-order payment.
 *     Focused on the compare-and-swap idempotency fix found in code review: Stripe redelivers
 *     webhooks at-least-once (and can deliver the same event concurrently), so a naive "read
 *     status, then write" guard lets two concurrent deliveries both pass the check and both
 *     trigger the mail batch -- these tests prove that can no longer happen.
 */
class StripeServiceTest {

    private final StripePort stripePort = mock(StripePort.class);
    private final VendorSubscriptionRepository subscriptionRepository = mock(VendorSubscriptionRepository.class);
    private final VendorService vendorService = mock(VendorService.class);
    private final PrintOrderRepository printOrderRepository = mock(PrintOrderRepository.class);
    private final PrintOrderService printOrderService = mock(PrintOrderService.class);
    private StripeService service;

    private final UUID vendorId = UUID.randomUUID();
    private final Instant now = Instant.now();
    private final UUID orderId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new StripeService(stripePort, subscriptionRepository, vendorService,
                printOrderRepository, printOrderService,
                "https://app.altarwed.com", "price_monthly", "price_annual",
                "price_premium_monthly", "price_premium_annual");
    }

    /** A service configured as prod is TODAY: Pro prices only, Premium blank (issue #370). */
    private StripeService serviceWithoutPremiumConfigured() {
        return new StripeService(stripePort, subscriptionRepository, vendorService,
                printOrderRepository, printOrderService,
                "https://app.altarwed.com", "price_monthly", "price_annual", "", "");
    }

    // -------------------------------------------------------------------------
    // Issue #45: checkout priceId allow-list
    // -------------------------------------------------------------------------

    @Test
    void createCheckoutSessionRejectsAPriceIdOutsideTheConfiguredAllowList() {
        assertThatThrownBy(() -> service.createCheckoutSession(vendorId, "vendor@example.com", "price_evil"))
                .isInstanceOf(InvalidPriceIdException.class);

        verifyNoInteractions(stripePort);
        verify(subscriptionRepository, never()).save(any());
    }

    @Test
    void createCheckoutSessionRejectsANullOrBlankPriceId() {
        assertThatThrownBy(() -> service.createCheckoutSession(vendorId, "vendor@example.com", null))
                .isInstanceOf(InvalidPriceIdException.class);
        assertThatThrownBy(() -> service.createCheckoutSession(vendorId, "vendor@example.com", ""))
                .isInstanceOf(InvalidPriceIdException.class);

        verifyNoInteractions(stripePort);
        verify(subscriptionRepository, never()).save(any());
    }

    @Test
    void createCheckoutSessionSucceedsForTheConfiguredMonthlyPrice() {
        when(subscriptionRepository.findByVendorId(vendorId)).thenReturn(Optional.of(activeSubscription(null)));
        when(stripePort.createCheckoutSession(eq(vendorId), eq("vendor@example.com"), eq("price_monthly"), any(), any()))
                .thenReturn("https://checkout.stripe.com/session_1");

        String url = service.createCheckoutSession(vendorId, "vendor@example.com", "price_monthly");

        assertThat(url).isEqualTo("https://checkout.stripe.com/session_1");
    }

    @Test
    void createCheckoutSessionSucceedsForTheConfiguredAnnualPrice() {
        when(subscriptionRepository.findByVendorId(vendorId)).thenReturn(Optional.of(activeSubscription(null)));
        when(stripePort.createCheckoutSession(eq(vendorId), eq("vendor@example.com"), eq("price_annual"), any(), any()))
                .thenReturn("https://checkout.stripe.com/session_2");

        String url = service.createCheckoutSession(vendorId, "vendor@example.com", "price_annual");

        assertThat(url).isEqualTo("https://checkout.stripe.com/session_2");
    }

    // -------------------------------------------------------------------------
    // Issue #370: pricing ladder (Premium tier config, allow-list, tier mapping)
    // -------------------------------------------------------------------------

    @Test
    void createCheckoutSessionSucceedsForTheConfiguredPremiumPrices() {
        when(subscriptionRepository.findByVendorId(vendorId)).thenReturn(Optional.of(activeSubscription(null)));
        when(stripePort.createCheckoutSession(eq(vendorId), eq("vendor@example.com"), eq("price_premium_monthly"), any(), any()))
                .thenReturn("https://checkout.stripe.com/session_3");
        when(stripePort.createCheckoutSession(eq(vendorId), eq("vendor@example.com"), eq("price_premium_annual"), any(), any()))
                .thenReturn("https://checkout.stripe.com/session_4");

        assertThat(service.createCheckoutSession(vendorId, "vendor@example.com", "price_premium_monthly"))
                .isEqualTo("https://checkout.stripe.com/session_3");
        assertThat(service.createCheckoutSession(vendorId, "vendor@example.com", "price_premium_annual"))
                .isEqualTo("https://checkout.stripe.com/session_4");
    }

    @Test
    void blankPremiumConfigRejectsPremiumPriceIds_prodBehaviorUnchangedUntilConfigured() {
        // The launch invariant: until Jordan sets the Premium price ids, a Premium-looking
        // price id is NOT in the allow-list, so nothing about the current $29 flow changes
        // and no crafted request can open a Premium checkout.
        StripeService unconfigured = serviceWithoutPremiumConfigured();

        assertThatThrownBy(() -> unconfigured.createCheckoutSession(vendorId, "vendor@example.com", "price_premium_monthly"))
                .isInstanceOf(InvalidPriceIdException.class);
        assertThatThrownBy(() -> unconfigured.createCheckoutSession(vendorId, "vendor@example.com", "price_premium_annual"))
                .isInstanceOf(InvalidPriceIdException.class);

        verifyNoInteractions(stripePort);
        verify(subscriptionRepository, never()).save(any());
    }

    @Test
    void webhookMapsAPremiumPriceIdToThePremiumTier() {
        when(subscriptionRepository.findByVendorId(vendorId)).thenReturn(Optional.empty());
        when(subscriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        StripeEventData event = subscriptionEvent(
                "customer.subscription.created", "active", now, "price_premium_monthly");
        when(stripePort.constructEvent(any(), any())).thenReturn(event);

        service.handleWebhook(new byte[0], "sig");

        ArgumentCaptor<VendorSubscription> captor = ArgumentCaptor.forClass(VendorSubscription.class);
        verify(subscriptionRepository).save(captor.capture());
        assertThat(captor.getValue().planTier()).isEqualTo(PlanTier.PREMIUM);
        assertThat(captor.getValue().status()).isEqualTo(SubscriptionStatus.ACTIVE);
    }

    @Test
    void webhookStillMapsAProPriceIdToTheFeaturedTier() {
        when(subscriptionRepository.findByVendorId(vendorId)).thenReturn(Optional.empty());
        when(subscriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        StripeEventData event = subscriptionEvent(
                "customer.subscription.created", "active", now, "price_annual");
        when(stripePort.constructEvent(any(), any())).thenReturn(event);

        service.handleWebhook(new byte[0], "sig");

        ArgumentCaptor<VendorSubscription> captor = ArgumentCaptor.forClass(VendorSubscription.class);
        verify(subscriptionRepository).save(captor.capture());
        assertThat(captor.getValue().planTier()).isEqualTo(PlanTier.FEATURED);
    }

    @Test
    void webhookMapsAnUnknownPriceIdToBasicNotPremium() {
        when(subscriptionRepository.findByVendorId(vendorId)).thenReturn(Optional.empty());
        when(subscriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        StripeEventData event = subscriptionEvent(
                "customer.subscription.created", "active", now, "price_someone_elses");
        when(stripePort.constructEvent(any(), any())).thenReturn(event);

        service.handleWebhook(new byte[0], "sig");

        ArgumentCaptor<VendorSubscription> captor = ArgumentCaptor.forClass(VendorSubscription.class);
        verify(subscriptionRepository).save(captor.capture());
        assertThat(captor.getValue().planTier()).isEqualTo(PlanTier.BASIC);
    }

    @Test
    void aPriceIdMistakenlyConfiguredForTwoTiersResolvesToTheLowerTier() {
        // Misconfiguration guard: if the same Stripe price id is pasted into both a Pro and a
        // Premium env var, the vendor must get the LOWER tier, never a free upgrade.
        StripeService misconfigured = new StripeService(stripePort, subscriptionRepository, vendorService,
                printOrderRepository, printOrderService,
                "https://app.altarwed.com", "price_shared", "price_annual", "price_shared", "price_premium_annual");
        when(subscriptionRepository.findByVendorId(vendorId)).thenReturn(Optional.empty());
        when(subscriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        StripeEventData event = subscriptionEvent(
                "customer.subscription.created", "active", now, "price_shared");
        when(stripePort.constructEvent(any(), any())).thenReturn(event);

        misconfigured.handleWebhook(new byte[0], "sig");

        ArgumentCaptor<VendorSubscription> captor = ArgumentCaptor.forClass(VendorSubscription.class);
        verify(subscriptionRepository).save(captor.capture());
        assertThat(captor.getValue().planTier()).isEqualTo(PlanTier.FEATURED);
    }

    // -------------------------------------------------------------------------
    // #115: subscription webhook staleness guard
    // -------------------------------------------------------------------------

    private VendorSubscription activeSubscription(LocalDateTime lastStripeEventAt) {
        LocalDateTime periodStart = LocalDateTime.ofInstant(now.minusSeconds(3600), ZoneOffset.UTC);
        LocalDateTime periodEnd = LocalDateTime.ofInstant(now.plusSeconds(3600 * 24 * 30), ZoneOffset.UTC);
        return new VendorSubscription(
                UUID.randomUUID(), vendorId, PlanTier.FEATURED, SubscriptionStatus.ACTIVE,
                "cus_123", "sub_123", periodStart, periodEnd, null,
                LocalDateTime.ofInstant(now.minusSeconds(3600 * 24), ZoneOffset.UTC),
                LocalDateTime.ofInstant(now, ZoneOffset.UTC),
                lastStripeEventAt
        );
    }

    private StripeEventData subscriptionEvent(String eventType, String stripeStatus, Instant eventCreatedAt) {
        return subscriptionEvent(eventType, stripeStatus, eventCreatedAt, "price_monthly");
    }

    private StripeEventData subscriptionEvent(String eventType, String stripeStatus, Instant eventCreatedAt,
                                              String priceId) {
        return new StripeEventData(
                eventType, "sub_123", "cus_123", vendorId.toString(), priceId, stripeStatus,
                now, now.plusSeconds(3600 * 24 * 30), null, eventCreatedAt,
                null, null, null, null
        );
    }

    @Test
    void aStaleSubscriptionUpdatedEventDoesNotReactivateAnAlreadyCancelledVendor() {
        LocalDateTime lastAppliedAt = LocalDateTime.ofInstant(now, ZoneOffset.UTC);
        VendorSubscription cancelled = new VendorSubscription(
                UUID.randomUUID(), vendorId, PlanTier.FEATURED, SubscriptionStatus.CANCELLED,
                "cus_123", "sub_123", null, null, lastAppliedAt,
                LocalDateTime.ofInstant(now.minusSeconds(3600 * 24), ZoneOffset.UTC), lastAppliedAt, lastAppliedAt
        );
        when(subscriptionRepository.findByVendorId(vendorId)).thenReturn(Optional.of(cancelled));

        // subscription.updated dated BEFORE the subscription.deleted event that already cancelled this row
        // (e.g. redelivered after a delay, or delivered out of order).
        Instant staleEventTime = now.minusSeconds(60);
        StripeEventData staleEvent = subscriptionEvent("customer.subscription.updated", "active", staleEventTime);
        when(stripePort.constructEvent(any(), any())).thenReturn(staleEvent);

        service.handleWebhook(new byte[0], "sig");

        verify(subscriptionRepository, never()).save(any());
        verify(vendorService, never()).verify(any());
    }

    @Test
    void aFreshSubscriptionUpdatedEventIsAppliedNormally() {
        VendorSubscription existing = activeSubscription(LocalDateTime.ofInstant(now.minusSeconds(120), ZoneOffset.UTC));
        when(subscriptionRepository.findByVendorId(vendorId)).thenReturn(Optional.of(existing));
        when(subscriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        StripeEventData freshEvent = subscriptionEvent("customer.subscription.updated", "active", now);
        when(stripePort.constructEvent(any(), any())).thenReturn(freshEvent);

        service.handleWebhook(new byte[0], "sig");

        ArgumentCaptor<VendorSubscription> captor = ArgumentCaptor.forClass(VendorSubscription.class);
        verify(subscriptionRepository).save(captor.capture());
        assertThat(captor.getValue().status()).isEqualTo(SubscriptionStatus.ACTIVE);
        assertThat(captor.getValue().lastStripeEventAt()).isEqualTo(LocalDateTime.ofInstant(now, ZoneOffset.UTC));
        verify(vendorService).verify(vendorId);
    }

    @Test
    void theFirstEventForAVendorWithNoExistingRowIsAlwaysApplied() {
        when(subscriptionRepository.findByVendorId(vendorId)).thenReturn(Optional.empty());
        when(subscriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        StripeEventData firstEvent = subscriptionEvent("customer.subscription.created", "active", now);
        when(stripePort.constructEvent(any(), any())).thenReturn(firstEvent);

        service.handleWebhook(new byte[0], "sig");

        verify(subscriptionRepository).save(any());
        verify(vendorService).verify(vendorId);
    }

    @Test
    void aStaleSubscriptionDeletedEventDoesNotCancelAVendorReactivatedByANewerEvent() {
        // Vendor resubscribed after an earlier cancellation; lastStripeEventAt reflects that
        // newer subscription.updated.
        LocalDateTime lastAppliedAt = LocalDateTime.ofInstant(now, ZoneOffset.UTC);
        VendorSubscription reactivated = new VendorSubscription(
                UUID.randomUUID(), vendorId, PlanTier.FEATURED, SubscriptionStatus.ACTIVE,
                "cus_123", "sub_123", null, null, null,
                LocalDateTime.ofInstant(now.minusSeconds(3600 * 24), ZoneOffset.UTC), lastAppliedAt, lastAppliedAt
        );
        when(subscriptionRepository.findByStripeSubscriptionId("sub_123")).thenReturn(Optional.of(reactivated));

        Instant staleDeleteTime = now.minusSeconds(60);
        StripeEventData staleDelete = new StripeEventData(
                "customer.subscription.deleted", "sub_123", "cus_123", vendorId.toString(),
                null, "canceled", null, null, staleDeleteTime, staleDeleteTime,
                null, null, null, null
        );
        when(stripePort.constructEvent(any(), any())).thenReturn(staleDelete);

        service.handleWebhook(new byte[0], "sig");

        verify(subscriptionRepository, never()).save(any());
        verify(vendorService, never()).unverify(any());
    }

    @Test
    void anEventTiedWithTheLastAppliedEventIsStillApplied() {
        // event.created is second-granularity; two distinct events can share a wall-clock second.
        // A tie must not be dropped as stale (that would be the #115 leak at the one-second
        // boundary) -- ties apply, last write wins.
        LocalDateTime lastAppliedAt = LocalDateTime.ofInstant(now, ZoneOffset.UTC);
        VendorSubscription existing = new VendorSubscription(
                UUID.randomUUID(), vendorId, PlanTier.FEATURED, SubscriptionStatus.ACTIVE,
                "cus_123", "sub_123", null, null, null,
                LocalDateTime.ofInstant(now.minusSeconds(3600 * 24), ZoneOffset.UTC), lastAppliedAt, lastAppliedAt
        );
        when(subscriptionRepository.findByStripeSubscriptionId("sub_123")).thenReturn(Optional.of(existing));

        StripeEventData tiedDelete = new StripeEventData(
                "customer.subscription.deleted", "sub_123", "cus_123", vendorId.toString(),
                null, "canceled", null, null, now, now,
                null, null, null, null
        );
        when(stripePort.constructEvent(any(), any())).thenReturn(tiedDelete);

        service.handleWebhook(new byte[0], "sig");

        verify(subscriptionRepository).save(any());
        verify(vendorService).unverify(vendorId);
    }

    @Test
    void aStaleEventLosesTheConcurrentInsertRaceRecoveryPathToo() {
        // Two webhooks for a brand-new vendor race the initial INSERT; the loser's save() throws,
        // it re-fetches, and must still apply the same staleness guard before overwriting.
        when(subscriptionRepository.findByVendorId(vendorId))
                .thenReturn(Optional.empty()) // first lookup: no row yet, attempt insert
                .thenReturn(Optional.of(activeSubscription(LocalDateTime.ofInstant(now, ZoneOffset.UTC)))); // race recovery lookup: winner's row, newer event already applied
        when(subscriptionRepository.save(any())).thenThrow(new DataIntegrityViolationException("concurrent insert"));

        Instant staleEventTime = now.minusSeconds(60);
        StripeEventData staleEvent = subscriptionEvent("customer.subscription.updated", "active", staleEventTime);
        when(stripePort.constructEvent(any(), any())).thenReturn(staleEvent);

        service.handleWebhook(new byte[0], "sig");

        // Only the failed insert attempt; the race-recovery branch must not re-save stale data.
        verify(subscriptionRepository, times(1)).save(any());
        verify(vendorService, never()).verify(any());
    }

    // -------------------------------------------------------------------------
    // Issue #59/#53: print-order checkout webhook handling
    // -------------------------------------------------------------------------

    private PrintOrder pendingOrder() {
        return new PrintOrder(orderId, UUID.randomUUID(), PrintOrderType.SAVE_THE_DATE, PrintOrderStatus.PENDING_PAYMENT,
                "SAVE_THE_DATE_CLASSIC", 1, 0, null, LocalDateTime.now(), null, List.of(), "idem-1",
                "cs_1", null, 200, 0, "Name", "1 Way", null, "City", "IL", "60601", null);
    }

    private StripeEventData completedEvent() {
        return new StripeEventData("checkout.session.completed", null, null, null, null, null, null, null, null,
                null, "cs_1", "pi_1", orderId.toString(), 200L);
    }

    private StripeEventData expiredEvent() {
        return new StripeEventData("checkout.session.expired", null, null, null, null, null, null, null, null,
                null, "cs_1", null, orderId.toString(), null);
    }

    @Test
    void checkoutCompleted_triggersTheBatchWhenItWinsTheTransition() {
        when(stripePort.constructEvent(any(), any())).thenReturn(completedEvent());
        when(printOrderRepository.findById(orderId)).thenReturn(Optional.of(pendingOrder()));
        when(printOrderRepository.markPaymentConfirmed(eq(orderId), eq("pi_1"))).thenReturn(true);

        service.handleWebhook(new byte[0], "sig");

        verify(printOrderService).submitBatchAsync(orderId);
    }

    @Test
    void checkoutCompleted_doesNotTriggerTheBatchTwiceOnConcurrentRedelivery() {
        // Simulates the exact race: markPaymentConfirmed's compare-and-swap only lets ONE caller
        // win (return true); a second concurrent/redelivered webhook for the same order sees
        // false and must not re-trigger the batch, or the order gets mailed and charged twice.
        when(stripePort.constructEvent(any(), any())).thenReturn(completedEvent());
        when(printOrderRepository.findById(orderId)).thenReturn(Optional.of(pendingOrder()));
        when(printOrderRepository.markPaymentConfirmed(eq(orderId), eq("pi_1"))).thenReturn(false);

        service.handleWebhook(new byte[0], "sig");

        verify(printOrderService, never()).submitBatchAsync(any());
    }

    @Test
    void checkoutCompleted_ignoredWhenOrderNotFound() {
        when(stripePort.constructEvent(any(), any())).thenReturn(completedEvent());
        when(printOrderRepository.findById(orderId)).thenReturn(Optional.empty());

        service.handleWebhook(new byte[0], "sig");

        verify(printOrderRepository, never()).markPaymentConfirmed(any(), any());
        verify(printOrderService, never()).submitBatchAsync(any());
    }

    @Test
    void checkoutCompleted_ignoredWhenPrintOrderIdMetadataMissing() {
        StripeEventData noMetadata = new StripeEventData("checkout.session.completed", null, null, null, null, null,
                null, null, null, null, "cs_1", "pi_1", null, 200L);
        when(stripePort.constructEvent(any(), any())).thenReturn(noMetadata);

        service.handleWebhook(new byte[0], "sig");

        verifyNoInteractions(printOrderRepository, printOrderService);
    }

    @Test
    void checkoutExpired_marksFailedOnlyWhenItWinsTheTransition() {
        when(stripePort.constructEvent(any(), any())).thenReturn(expiredEvent());
        when(printOrderRepository.findById(orderId)).thenReturn(Optional.of(pendingOrder()));
        when(printOrderRepository.markPaymentFailed(eq(orderId), any())).thenReturn(true);

        service.handleWebhook(new byte[0], "sig");

        verify(printOrderRepository).markPaymentFailed(eq(orderId), any());
        verifyNoInteractions(printOrderService);
    }

    @Test
    void checkoutExpired_doesNothingMoreOnRedeliveryAfterAlreadyResolved() {
        when(stripePort.constructEvent(any(), any())).thenReturn(expiredEvent());
        when(printOrderRepository.findById(orderId)).thenReturn(Optional.of(pendingOrder()));
        when(printOrderRepository.markPaymentFailed(eq(orderId), any())).thenReturn(false);

        service.handleWebhook(new byte[0], "sig");

        verifyNoInteractions(printOrderService);
    }
}
