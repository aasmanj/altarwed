package com.altarwed.application.service;

import com.altarwed.domain.model.PrintOrder;
import com.altarwed.domain.model.PrintOrderStatus;
import com.altarwed.domain.model.PrintOrderType;
import com.altarwed.domain.port.PrintOrderRepository;
import com.altarwed.domain.port.StripePort;
import com.altarwed.domain.port.StripePort.CheckoutSessionStatus;
import com.altarwed.domain.port.VendorSubscriptionRepository;
import net.javacrumbs.shedlock.core.LockAssert;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link PrintOrderPaymentReconciliationService} (issue #209), the hourly job
 * that converges print orders stuck in PENDING_PAYMENT after a lost Stripe webhook.
 *
 * Mockito, no Spring context, per backend/CLAUDE.md's application/service testing convention.
 * The StripeService in play is REAL (its ports are mocks), deliberately: the whole point of
 * #209 is that a reconciled order must travel the exact same code path as a delivered
 * checkout.session.completed webhook, so these tests assert all the way down to the
 * markPaymentConfirmed compare-and-swap and the submitBatchAsync trigger rather than
 * verifying a call on a mocked facade.
 */
@ExtendWith(MockitoExtension.class)
class PrintOrderPaymentReconciliationServiceTest {

    @BeforeAll
    static void allowLockAssertOutsideRealSchedulerLock() {
        // reconcileStuckOrders() calls LockAssert.assertLocked(); these tests build the service
        // with plain `new` and no Spring AOP proxy, so there is never a real ShedLock lock.
        // Matches RsvpReminderServiceTest's documented pattern.
        LockAssert.TestHelper.makeAllAssertsPass(true);
    }

    @Mock private PrintOrderRepository printOrderRepository;
    @Mock private StripePort stripePort;
    @Mock private VendorSubscriptionRepository subscriptionRepository;
    @Mock private VendorService vendorService;
    @Mock private PrintOrderService printOrderService;

    private PrintOrderPaymentReconciliationService service;

    private static final int GRACE_MINUTES = 30;
    private static final int ABANDON_HOURS = 48;

    @BeforeEach
    void setUp() {
        StripeService stripeService = new StripeService(stripePort, subscriptionRepository, vendorService,
                printOrderRepository, printOrderService,
                "https://app.altarwed.com", "price_monthly", "price_annual", "", "");
        service = new PrintOrderPaymentReconciliationService(
                printOrderRepository, stripePort, stripeService, GRACE_MINUTES, ABANDON_HOURS);
    }

    private PrintOrder stuckOrder(UUID orderId, String sessionId, LocalDateTime createdAt) {
        return new PrintOrder(orderId, UUID.randomUUID(), PrintOrderType.SAVE_THE_DATE,
                PrintOrderStatus.PENDING_PAYMENT, "SAVE_THE_DATE_CLASSIC", 1, 0, null,
                createdAt, null, List.of(), "idem-1",
                sessionId, null, 200, 0, "Name", "1 Way", null, "City", "IL", "60601", null);
    }

    private PrintOrder stuckOrder(UUID orderId, String sessionId) {
        return stuckOrder(orderId, sessionId, LocalDateTime.now().minusHours(2));
    }

    // ─── Pinned behavior 1: paid stuck order converges via the shared webhook path, once ───────

    @Test
    void paidStuckOrder_convergesThroughTheSharedWebhookPath() {
        UUID orderId = UUID.randomUUID();
        when(printOrderRepository.findPendingPaymentCreatedBefore(any()))
                .thenReturn(List.of(stuckOrder(orderId, "cs_1")));
        when(stripePort.retrieveCheckoutSessionStatus("cs_1"))
                .thenReturn(new CheckoutSessionStatus("complete", "paid", "pi_9"));
        when(printOrderRepository.markPaymentConfirmed(orderId, "pi_9")).thenReturn(true);

        service.reconcileStuckOrders();

        // The exact writes a delivered checkout.session.completed webhook makes, nothing else.
        verify(printOrderRepository).markPaymentConfirmed(orderId, "pi_9");
        verify(printOrderService).submitBatchAsync(orderId);
        verify(printOrderRepository, never()).markPaymentFailed(any(), any());
    }

    @Test
    void paidStuckOrder_isIdempotentOnRerun_neverDoubleSubmitsTheBatch() {
        UUID orderId = UUID.randomUUID();
        when(printOrderRepository.findPendingPaymentCreatedBefore(any()))
                .thenReturn(List.of(stuckOrder(orderId, "cs_1")));
        when(stripePort.retrieveCheckoutSessionStatus("cs_1"))
                .thenReturn(new CheckoutSessionStatus("complete", "paid", "pi_9"));
        // First run wins the compare-and-swap; the second run (or a late webhook replaying the
        // same transition) loses it because the row is no longer PENDING_PAYMENT.
        when(printOrderRepository.markPaymentConfirmed(orderId, "pi_9")).thenReturn(true, false);

        service.reconcileStuckOrders();
        service.reconcileStuckOrders();

        // Exactly one Lob batch trigger across both runs: re-running converges, never re-mails.
        verify(printOrderService, times(1)).submitBatchAsync(orderId);
    }

    @Test
    void paidOrder_winsOverAnExpiredSession_neverMarkedFailed() {
        // A session can be expired AND paid (the couple paid, then the session object aged out
        // of "complete" reporting oddly, or a race between expiry and completion). The money
        // truth (payment_status) must always win over the session lifecycle: a charged couple
        // converges to fulfillment, never to FAILED.
        UUID orderId = UUID.randomUUID();
        when(printOrderRepository.findPendingPaymentCreatedBefore(any()))
                .thenReturn(List.of(stuckOrder(orderId, "cs_1")));
        when(stripePort.retrieveCheckoutSessionStatus("cs_1"))
                .thenReturn(new CheckoutSessionStatus("expired", "paid", "pi_9"));
        when(printOrderRepository.markPaymentConfirmed(orderId, "pi_9")).thenReturn(true);

        service.reconcileStuckOrders();

        verify(printOrderRepository).markPaymentConfirmed(orderId, "pi_9");
        verify(printOrderService).submitBatchAsync(orderId);
        verify(printOrderRepository, never()).markPaymentFailed(any(), any());
    }

    @Test
    void paidStuckOrder_doesNotTriggerTheBatchWhenALateWebhookAlreadyWon() {
        // The lost webhook finally lands between our stuck-order query and the CAS: the CAS
        // returns false and the reconciler must treat the order as already resolved.
        UUID orderId = UUID.randomUUID();
        when(printOrderRepository.findPendingPaymentCreatedBefore(any()))
                .thenReturn(List.of(stuckOrder(orderId, "cs_1")));
        when(stripePort.retrieveCheckoutSessionStatus("cs_1"))
                .thenReturn(new CheckoutSessionStatus("complete", "paid", "pi_9"));
        when(printOrderRepository.markPaymentConfirmed(orderId, "pi_9")).thenReturn(false);

        service.reconcileStuckOrders();

        verify(printOrderService, never()).submitBatchAsync(any());
        verify(printOrderRepository, never()).markPaymentFailed(any(), any());
    }

    // ─── Pinned behavior 2: open unpaid session is left untouched ──────────────────────────────

    @Test
    void openUnpaidOrder_isLeftUntouched() {
        UUID orderId = UUID.randomUUID();
        when(printOrderRepository.findPendingPaymentCreatedBefore(any()))
                .thenReturn(List.of(stuckOrder(orderId, "cs_1")));
        when(stripePort.retrieveCheckoutSessionStatus("cs_1"))
                .thenReturn(new CheckoutSessionStatus("open", "unpaid", null));

        service.reconcileStuckOrders();

        verify(printOrderRepository, never()).markPaymentConfirmed(any(), any());
        verify(printOrderRepository, never()).markPaymentFailed(any(), any());
        verifyNoInteractions(printOrderService);
    }

    // ─── Pinned behavior 3: expired unpaid session is marked failed like the webhook would ─────

    @Test
    void expiredUnpaidOrder_isMarkedFailedWithTheWebhookMessage() {
        UUID orderId = UUID.randomUUID();
        when(printOrderRepository.findPendingPaymentCreatedBefore(any()))
                .thenReturn(List.of(stuckOrder(orderId, "cs_1")));
        when(stripePort.retrieveCheckoutSessionStatus("cs_1"))
                .thenReturn(new CheckoutSessionStatus("expired", "unpaid", null));
        when(printOrderRepository.markPaymentFailed(orderId, StripeService.CHECKOUT_EXPIRED_MESSAGE))
                .thenReturn(true);

        service.reconcileStuckOrders();

        // Identical terminal state to a delivered checkout.session.expired webhook: same status
        // (FAILED), same message, no batch, no refund (nothing was ever charged).
        verify(printOrderRepository).markPaymentFailed(orderId, StripeService.CHECKOUT_EXPIRED_MESSAGE);
        verify(printOrderRepository, never()).markPaymentConfirmed(any(), any());
        verifyNoInteractions(printOrderService);
    }

    @Test
    void openUnpaidOrderPastTheAbandonmentHorizon_isMarkedFailed() {
        // Defensive floor: Stripe caps sessions at 24h, so open-at-49h should be impossible,
        // but if it happens the order must not poll forever.
        UUID orderId = UUID.randomUUID();
        when(printOrderRepository.findPendingPaymentCreatedBefore(any()))
                .thenReturn(List.of(stuckOrder(orderId, "cs_1", LocalDateTime.now().minusHours(ABANDON_HOURS + 1))));
        when(stripePort.retrieveCheckoutSessionStatus("cs_1"))
                .thenReturn(new CheckoutSessionStatus("open", "unpaid", null));
        when(printOrderRepository.markPaymentFailed(orderId, StripeService.CHECKOUT_EXPIRED_MESSAGE))
                .thenReturn(true);

        service.reconcileStuckOrders();

        verify(printOrderRepository).markPaymentFailed(orderId, StripeService.CHECKOUT_EXPIRED_MESSAGE);
        verifyNoInteractions(printOrderService);
    }

    // ─── Pinned behavior 4: the grace window bounds the stuck-order query ──────────────────────

    @Test
    void queryCutoff_respectsTheConfiguredGraceWindow() {
        when(printOrderRepository.findPendingPaymentCreatedBefore(any())).thenReturn(List.of());

        LocalDateTime before = LocalDateTime.now();
        service.reconcileStuckOrders();
        LocalDateTime after = LocalDateTime.now();

        ArgumentCaptor<LocalDateTime> cutoff = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(printOrderRepository).findPendingPaymentCreatedBefore(cutoff.capture());
        // Cutoff must be now - grace: any order created inside the last 30 minutes is a couple
        // plausibly still mid-checkout and never even queried, let alone sent to Stripe.
        assertThat(cutoff.getValue())
                .isAfterOrEqualTo(before.minusMinutes(GRACE_MINUTES))
                .isBeforeOrEqualTo(after.minusMinutes(GRACE_MINUTES));
        verifyNoInteractions(stripePort);
    }

    // ─── Pinned behavior 5: one order's Stripe failure never aborts the batch ──────────────────

    @Test
    void stripeErrorOnOneOrder_doesNotAbortTheRestOfTheBatch() {
        UUID failingId = UUID.randomUUID();
        UUID paidId = UUID.randomUUID();
        when(printOrderRepository.findPendingPaymentCreatedBefore(any()))
                .thenReturn(List.of(stuckOrder(failingId, "cs_bad"), stuckOrder(paidId, "cs_good")));
        when(stripePort.retrieveCheckoutSessionStatus("cs_bad"))
                .thenThrow(new StripePort.StripeCallException("boom"));
        when(stripePort.retrieveCheckoutSessionStatus("cs_good"))
                .thenReturn(new CheckoutSessionStatus("complete", "paid", "pi_2"));
        when(printOrderRepository.markPaymentConfirmed(paidId, "pi_2")).thenReturn(true);

        // The job itself must never throw (a crash here would also kill later scheduled runs'
        // usefulness for this window) and the second order must still converge.
        assertThatCode(() -> service.reconcileStuckOrders()).doesNotThrowAnyException();

        verify(printOrderService).submitBatchAsync(paidId);
        verify(printOrderRepository, never()).markPaymentConfirmed(eq(failingId), any());
    }

    // ─── Edge guards ───────────────────────────────────────────────────────────────────────────

    @Test
    void orderWithoutACheckoutSession_isSkippedWithoutCallingStripe() {
        UUID orderId = UUID.randomUUID();
        when(printOrderRepository.findPendingPaymentCreatedBefore(any()))
                .thenReturn(List.of(stuckOrder(orderId, null)));

        service.reconcileStuckOrders();

        verifyNoInteractions(stripePort);
        verify(printOrderRepository, never()).markPaymentConfirmed(any(), any());
        verify(printOrderRepository, never()).markPaymentFailed(any(), any());
    }

    @Test
    void completeButUnpaidSession_isLeftUntouched() {
        // "no_payment_required" (or any future unknown state): never fulfill without a captured
        // payment, never fail a session Stripe calls complete.
        UUID orderId = UUID.randomUUID();
        when(printOrderRepository.findPendingPaymentCreatedBefore(any()))
                .thenReturn(List.of(stuckOrder(orderId, "cs_1")));
        when(stripePort.retrieveCheckoutSessionStatus("cs_1"))
                .thenReturn(new CheckoutSessionStatus("complete", "no_payment_required", null));

        service.reconcileStuckOrders();

        verify(printOrderRepository, never()).markPaymentConfirmed(any(), any());
        verify(printOrderRepository, never()).markPaymentFailed(any(), any());
        verifyNoInteractions(printOrderService);
    }
}
