package com.altarwed.application.service;

import com.altarwed.domain.model.PrintOrder;
import com.altarwed.domain.model.PrintOrderStatus;
import com.altarwed.domain.model.PrintOrderType;
import com.altarwed.domain.port.PrintOrderRepository;
import com.altarwed.domain.port.StripePort;
import com.altarwed.domain.port.StripePort.StripeEventData;
import com.altarwed.domain.port.VendorSubscriptionRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Issue #59/#53 webhook handling. Mockito, no Spring context, per backend/CLAUDE.md's
 * application/service testing convention. Focused on the compare-and-swap idempotency fix found
 * in code review: Stripe redelivers webhooks at-least-once (and can deliver the same event
 * concurrently), so a naive "read status, then write" guard lets two concurrent deliveries both
 * pass the check and both trigger the mail batch -- these tests prove that can no longer happen.
 */
class StripeServiceTest {

    private final StripePort stripePort = mock(StripePort.class);
    private final VendorSubscriptionRepository subscriptionRepository = mock(VendorSubscriptionRepository.class);
    private final VendorService vendorService = mock(VendorService.class);
    private final PrintOrderRepository printOrderRepository = mock(PrintOrderRepository.class);
    private final PrintOrderService printOrderService = mock(PrintOrderService.class);

    private final StripeService service = new StripeService(
            stripePort, subscriptionRepository, vendorService, printOrderRepository, printOrderService,
            "https://app.altarwed.test", "", "");

    private final UUID orderId = UUID.randomUUID();

    private PrintOrder pendingOrder() {
        return new PrintOrder(orderId, UUID.randomUUID(), PrintOrderType.SAVE_THE_DATE, PrintOrderStatus.PENDING_PAYMENT,
                "SAVE_THE_DATE_CLASSIC", 1, 0, null, LocalDateTime.now(), null, List.of(), "idem-1",
                "cs_1", null, 200, 0, "Name", "1 Way", null, "City", "IL", "60601");
    }

    private StripeEventData completedEvent() {
        return new StripeEventData("checkout.session.completed", null, null, null, null, null, null, null, null,
                "cs_1", "pi_1", orderId.toString(), 200L);
    }

    private StripeEventData expiredEvent() {
        return new StripeEventData("checkout.session.expired", null, null, null, null, null, null, null, null,
                "cs_1", null, orderId.toString(), null);
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
                null, null, null, "cs_1", "pi_1", null, 200L);
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
