package com.altarwed.application.service;

import com.altarwed.domain.model.PlanTier;
import com.altarwed.domain.model.SubscriptionStatus;
import com.altarwed.domain.model.VendorSubscription;
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
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

// #115: a delayed/out-of-order Stripe webhook must never overwrite state that a later event
// already applied. These tests exercise StripeService.handleWebhook end-to-end (via the public
// entry point) against a stubbed StripePort/VendorSubscriptionRepository, no Spring context.
class StripeServiceTest {

    private final StripePort stripePort = mock(StripePort.class);
    private final VendorSubscriptionRepository subscriptionRepository = mock(VendorSubscriptionRepository.class);
    private final VendorService vendorService = mock(VendorService.class);
    private StripeService service;

    private final UUID vendorId = UUID.randomUUID();
    private final Instant now = Instant.now();

    @BeforeEach
    void setUp() {
        service = new StripeService(stripePort, subscriptionRepository, vendorService,
                "https://app.altarwed.com", "price_monthly", "price_annual");
    }

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
        return new StripeEventData(
                eventType, "sub_123", "cus_123", vendorId.toString(), "price_monthly", stripeStatus,
                now, now.plusSeconds(3600 * 24 * 30), null, eventCreatedAt
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
                null, "canceled", null, null, staleDeleteTime, staleDeleteTime
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
                null, "canceled", null, null, now, now
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
}
