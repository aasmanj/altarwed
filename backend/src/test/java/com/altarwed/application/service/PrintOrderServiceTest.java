package com.altarwed.application.service;

import com.altarwed.application.dto.CreatePrintOrderRequest;
import com.altarwed.application.dto.CreateTestPrintOrderRequest;
import com.altarwed.domain.model.*;
import com.altarwed.domain.port.*;
import com.altarwed.domain.port.PrintMailPort.AddressVerificationResult;
import com.altarwed.domain.port.PrintMailPort.PostcardStatusResult;
import com.altarwed.domain.port.PrintMailPort.ToAddress;
import com.altarwed.domain.port.StripePort.StripeCallException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Unit tests for issues #59 (payment gate) + #53 (async Lob batch). Mockito, no Spring context,
 * per backend/CLAUDE.md's application/service testing convention.
 */
class PrintOrderServiceTest {

    private final PrintOrderRepository printOrderRepository = mock(PrintOrderRepository.class);
    private final PrintMailPort printMailPort = mock(PrintMailPort.class);
    private final GuestRepository guestRepository = mock(GuestRepository.class);
    private final WeddingWebsiteRepository websiteRepository = mock(WeddingWebsiteRepository.class);
    private final CoupleRepository coupleRepository = mock(CoupleRepository.class);
    private final StripePort stripePort = mock(StripePort.class);

    private final PrintOrderService service = new PrintOrderService(
            printOrderRepository, printMailPort, guestRepository, websiteRepository, coupleRepository,
            stripePort, "https://app.altarwed.test");

    private final UUID coupleId = UUID.randomUUID();
    private final UUID orderId = UUID.randomUUID();

    // ── Test data builders ──────────────────────────────────────────────────────────────────

    private Guest guest(UUID id, UUID coupleId, String name, String line1, String city,
                        String state, String zip, String country) {
        return new Guest(
                id, coupleId, name, null, null,
                GuestRsvpStatus.PENDING, false, null, null, null,
                null, null, null,
                line1, city, state, zip, country,
                null, 0,
                null, null, null,
                null, null, null,
                null, null, null,
                null, false);
    }

    private Guest domesticGuest(UUID id, String name) {
        return guest(id, coupleId, name, "123 Main St", "Springfield", "IL", "62704", null);
    }

    private Couple couple() {
        return new Couple(coupleId, "Jordan", "Eden", "couple@example.test", "hash",
                null, null, AcquisitionSource.empty(), false, true, LocalDateTime.now(), LocalDateTime.now());
    }

    private CreatePrintOrderRequest requestFor(List<UUID> guestIds) {
        return new CreatePrintOrderRequest(
                "SAVE_THE_DATE", "SAVE_THE_DATE_CLASSIC", guestIds,
                "The Couple", "1 Return Way", null, "Chicago", "il", "60601", "idem-1", null);
    }

    private PrintOrder orderWith(List<PrintOrderRecipient> recipients) {
        LocalDateTime now = LocalDateTime.now();
        return new PrintOrder(orderId, coupleId, PrintOrderType.SAVE_THE_DATE, PrintOrderStatus.SUBMITTED,
                "SAVE_THE_DATE_CLASSIC", recipients.size(), recipients.size() * 200, null, now, now,
                recipients, "idem-1", null, null, null, 0, null, null, null, null, null, null, null);
    }

    private PrintOrderRecipient recipient(String lobId, String status) {
        return new PrintOrderRecipient(UUID.randomUUID(), orderId, UUID.randomUUID(), lobId, status, null, null, null);
    }

    // ── refreshDeliveryStatuses (unchanged behavior, updated for the new PostcardStatusResult) ──

    @Test
    void refresh_updates_status_from_lob_and_saves() {
        var r = recipient("psc_1", "SUBMITTED");
        when(printOrderRepository.findById(orderId)).thenReturn(Optional.of(orderWith(List.of(r))));
        when(printMailPort.fetchPostcardStatus("psc_1"))
                .thenReturn(Optional.of(new PostcardStatusResult("Delivered", null, null)));
        when(printOrderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PrintOrder result = service.refreshDeliveryStatuses(coupleId, orderId);

        ArgumentCaptor<PrintOrder> captor = ArgumentCaptor.forClass(PrintOrder.class);
        verify(printOrderRepository).save(captor.capture());
        assertThat(captor.getValue().recipients().get(0).deliveryStatus()).isEqualTo("Delivered");
        assertThat(result.recipients().get(0).deliveryStatus()).isEqualTo("Delivered");
    }

    @Test
    void refresh_skips_recipients_without_a_provider_id() {
        var failed = recipient(null, "FAILED");
        when(printOrderRepository.findById(orderId)).thenReturn(Optional.of(orderWith(List.of(failed))));

        PrintOrder result = service.refreshDeliveryStatuses(coupleId, orderId);

        verify(printMailPort, never()).fetchPostcardStatus(any());
        verify(printOrderRepository, never()).save(any());
        assertThat(result.recipients().get(0).deliveryStatus()).isEqualTo("FAILED");
    }

    @Test
    void refresh_does_not_write_when_status_and_tracking_are_unchanged() {
        var r = recipient("psc_1", "In Transit");
        when(printOrderRepository.findById(orderId)).thenReturn(Optional.of(orderWith(List.of(r))));
        when(printMailPort.fetchPostcardStatus("psc_1"))
                .thenReturn(Optional.of(new PostcardStatusResult("In Transit", null, null)));

        service.refreshDeliveryStatuses(coupleId, orderId);

        verify(printMailPort).fetchPostcardStatus("psc_1");
        verify(printOrderRepository, never()).save(any());
    }

    @Test
    void refresh_skips_recipients_already_in_a_terminal_state() {
        var delivered = recipient("psc_1", "Delivered");
        var returned = recipient("psc_2", "Returned to Sender");
        when(printOrderRepository.findById(orderId))
                .thenReturn(Optional.of(orderWith(List.of(delivered, returned))));

        service.refreshDeliveryStatuses(coupleId, orderId);

        verify(printMailPort, never()).fetchPostcardStatus(any());
        verify(printOrderRepository, never()).save(any());
    }

    @Test
    void refresh_rejects_an_order_not_owned_by_the_couple() {
        var othersOrder = new PrintOrder(orderId, UUID.randomUUID(), PrintOrderType.SAVE_THE_DATE,
                PrintOrderStatus.SUBMITTED, "k", 0, 0, null, LocalDateTime.now(), null, List.of(), "i",
                null, null, null, 0, null, null, null, null, null, null, null);
        when(printOrderRepository.findById(orderId)).thenReturn(Optional.of(othersOrder));

        assertThatThrownBy(() -> service.refreshDeliveryStatuses(coupleId, orderId))
                .isInstanceOf(IllegalArgumentException.class);
        verify(printMailPort, never()).fetchPostcardStatus(any());
    }

    // ── createOrder: issue #59 payment gate + pre-payment validation ────────────────────────────

    @Test
    void createOrder_replaysIdempotentRequest_withoutTouchingStripeOrLob() {
        PrintOrder existing = orderWith(List.of());
        when(printOrderRepository.findByCoupleIdAndIdempotencyKey(coupleId, "idem-1"))
                .thenReturn(Optional.of(existing));

        var result = service.createOrder(coupleId, requestFor(List.of(UUID.randomUUID())));

        assertThat(result.order()).isEqualTo(existing);
        assertThat(result.checkoutUrl()).isNull();
        verifyNoInteractions(stripePort);
        verify(printOrderRepository, never()).save(any());
    }

    @Test
    void createOrder_rejectsUnknownTemplateKey_beforeChargingOrPersisting() {
        // Issue #352: everything else about this request is valid (real couple, deliverable guest,
        // stubbed persistence + Stripe), so WITHOUT the server-side allowlist the order would sail
        // through to save() + Checkout. The only defect is a bogus, couple-supplied templateKey.
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.of(couple()));
        UUID guestId = UUID.randomUUID();
        when(guestRepository.findById(guestId)).thenReturn(Optional.of(domesticGuest(guestId, "Guest One")));
        when(printMailPort.verifyAddress(any())).thenReturn(new AddressVerificationResult(true, null));
        stubSuccessfulOrderPersistence();

        var req = new CreatePrintOrderRequest(
                "SAVE_THE_DATE", "SAVE_THE_DATE_HACKER", List.of(guestId),
                "The Couple", "1 Return Way", null, "Chicago", "il", "60601", "idem-352", null);

        assertThatThrownBy(() -> service.createOrder(coupleId, req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("template");

        // Rejected before any durable side-effect: no order row, no recipient rows, no charge.
        verify(printOrderRepository, never()).save(any());
        verify(printOrderRepository, never()).appendRecipient(any(), any());
        verifyNoInteractions(stripePort);
    }

    @Test
    void createOrder_throwsWhenCoupleNotFound() {
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createOrder(coupleId, requestFor(List.of(UUID.randomUUID()))))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(stripePort);
    }

    @Test
    void createOrder_throwsWhenEveryGuestIsExcluded() {
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.of(couple()));
        UUID guestId = UUID.randomUUID();
        // missing mailLine1 -> excluded on the field-presence check
        Guest badAddress = guest(guestId, coupleId, "Bad Address", null, "City", "IL", "60601", null);
        when(guestRepository.findById(guestId)).thenReturn(Optional.of(badAddress));

        assertThatThrownBy(() -> service.createOrder(coupleId, requestFor(List.of(guestId))))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(stripePort);
        verify(printOrderRepository, never()).save(any());
    }

    @Test
    void createOrder_excludesGuestNotFoundOrNotOwned() {
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.of(couple()));
        UUID validGuestId = UUID.randomUUID();
        UUID missingGuestId = UUID.randomUUID();
        when(guestRepository.findById(validGuestId)).thenReturn(Optional.of(domesticGuest(validGuestId, "Valid")));
        when(guestRepository.findById(missingGuestId)).thenReturn(Optional.empty());
        when(printMailPort.verifyAddress(any())).thenReturn(new AddressVerificationResult(true, null));
        stubSuccessfulOrderPersistence();
        when(stripePort.createOneTimeCheckoutSession(any(), any(), anyLong(), any(), any(), any()))
                .thenReturn(new StripePort.CheckoutSession("cs_test_123", "https://checkout.stripe.com/c/pay/cs_test_123#fragment"));

        var result = service.createOrder(coupleId, requestFor(List.of(validGuestId, missingGuestId)));

        assertThat(result.excludedGuests()).hasSize(1);
        assertThat(result.excludedGuests().get(0).guestId()).isEqualTo(missingGuestId);
        // Only the valid guest is charged for: 1 * 200 cents.
        verify(stripePort).createOneTimeCheckoutSession(any(), any(), eq(200L), any(), any(), any());
    }

    @Test
    void createOrder_excludesDomesticAddressLobCannotVerify_withoutCharging() {
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.of(couple()));
        UUID guestId = UUID.randomUUID();
        UUID okGuestId = UUID.randomUUID();
        Guest unverifiable = domesticGuest(guestId, "Unverifiable");
        Guest ok = domesticGuest(okGuestId, "OK Guest");
        when(guestRepository.findById(guestId)).thenReturn(Optional.of(unverifiable));
        when(guestRepository.findById(okGuestId)).thenReturn(Optional.of(ok));
        // Simulate Lob flagging one address as undeliverable, the other as fine.
        when(printMailPort.verifyAddress(argThat(a -> a != null && a.name().equals("Unverifiable"))))
                .thenReturn(new AddressVerificationResult(false, "This address could not be verified as a valid USPS deliverable address."));
        when(printMailPort.verifyAddress(argThat(a -> a != null && a.name().equals("OK Guest"))))
                .thenReturn(new AddressVerificationResult(true, null));
        stubSuccessfulOrderPersistence();
        when(stripePort.createOneTimeCheckoutSession(any(), any(), anyLong(), any(), any(), any()))
                .thenReturn(new StripePort.CheckoutSession("cs_test_123", "https://checkout.stripe.com/c/pay/cs_test_123#fragment"));

        var result = service.createOrder(coupleId, requestFor(List.of(guestId, okGuestId)));

        assertThat(result.excludedGuests()).hasSize(1);
        assertThat(result.excludedGuests().get(0).reason()).contains("USPS deliverable");
        // Only the verified guest is charged for.
        verify(stripePort).createOneTimeCheckoutSession(any(), any(), eq(200L), any(), any(), any());
        // The excluded guest's recipient row was persisted as FAILED, never PENDING (never sent to Lob).
        ArgumentCaptor<PrintOrderRecipient> recipientCaptor = ArgumentCaptor.forClass(PrintOrderRecipient.class);
        verify(printOrderRepository, times(2)).appendRecipient(any(), recipientCaptor.capture());
        assertThat(recipientCaptor.getAllValues())
                .filteredOn(r -> r.guestId().equals(guestId))
                .extracting(PrintOrderRecipient::deliveryStatus)
                .containsExactly("FAILED");
    }

    @Test
    void createOrder_doesNotVerifyInternationalAddresses() {
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.of(couple()));
        UUID guestId = UUID.randomUUID();
        Guest international = guest(guestId, coupleId, "Int'l Guest", "1 Rue de Paris", "Paris", null, "75001", "France");
        when(guestRepository.findById(guestId)).thenReturn(Optional.of(international));
        stubSuccessfulOrderPersistence();
        when(stripePort.createOneTimeCheckoutSession(any(), any(), anyLong(), any(), any(), any()))
                .thenReturn(new StripePort.CheckoutSession("cs_test_123", "https://checkout.stripe.com/c/pay/cs_test_123#fragment"));

        var result = service.createOrder(coupleId, requestFor(List.of(guestId)));

        verify(printMailPort, never()).verifyAddress(any());
        assertThat(result.excludedGuests()).isEmpty();
    }

    @Test
    void createOrder_warnsButDoesNotBlockOnDuplicateAddresses() {
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.of(couple()));
        UUID guest1 = UUID.randomUUID();
        UUID guest2 = UUID.randomUUID();
        when(guestRepository.findById(guest1)).thenReturn(Optional.of(domesticGuest(guest1, "Jane Doe")));
        when(guestRepository.findById(guest2)).thenReturn(Optional.of(domesticGuest(guest2, "John Doe")));
        when(printMailPort.verifyAddress(any())).thenReturn(new AddressVerificationResult(true, null));
        stubSuccessfulOrderPersistence();
        when(stripePort.createOneTimeCheckoutSession(any(), any(), anyLong(), any(), any(), any()))
                .thenReturn(new StripePort.CheckoutSession("cs_test_123", "https://checkout.stripe.com/c/pay/cs_test_123#fragment"));

        var result = service.createOrder(coupleId, requestFor(List.of(guest1, guest2)));

        assertThat(result.excludedGuests()).isEmpty();
        assertThat(result.warnings()).hasSize(1);
        assertThat(result.warnings().get(0)).contains("Jane Doe").contains("John Doe");
        // Both guests are still charged for and sent -- a warning, not a block.
        verify(stripePort).createOneTimeCheckoutSession(any(), any(), eq(400L), any(), any(), any());
    }

    @Test
    void createOrder_createsPendingPaymentOrderAndChecksOutForExactAmount() {
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.of(couple()));
        UUID guestId = UUID.randomUUID();
        when(guestRepository.findById(guestId)).thenReturn(Optional.of(domesticGuest(guestId, "Guest One")));
        when(printMailPort.verifyAddress(any())).thenReturn(new AddressVerificationResult(true, null));
        stubSuccessfulOrderPersistence();
        when(stripePort.createOneTimeCheckoutSession(any(), any(), anyLong(), any(), any(), any()))
                .thenReturn(new StripePort.CheckoutSession("cs_test_abc", "https://checkout.stripe.com/c/pay/cs_test_abc#fragment"));

        var result = service.createOrder(coupleId, requestFor(List.of(guestId)));

        ArgumentCaptor<PrintOrder> orderCaptor = ArgumentCaptor.forClass(PrintOrder.class);
        verify(printOrderRepository).save(orderCaptor.capture());
        assertThat(orderCaptor.getValue().status()).isEqualTo(PrintOrderStatus.PENDING_PAYMENT);
        assertThat(orderCaptor.getValue().amountChargedCents()).isEqualTo(200);

        verify(printOrderRepository).attachCheckoutSession(eq(orderId), eq("cs_test_abc"));
        assertThat(result.checkoutUrl()).isEqualTo("https://checkout.stripe.com/c/pay/cs_test_abc#fragment");

        // The one payable guest got a PENDING recipient row (not yet sent to Lob -- payment first).
        ArgumentCaptor<PrintOrderRecipient> recipientCaptor = ArgumentCaptor.forClass(PrintOrderRecipient.class);
        verify(printOrderRepository).appendRecipient(eq(orderId), recipientCaptor.capture());
        assertThat(recipientCaptor.getValue().deliveryStatus()).isEqualTo("PENDING");
        verify(printMailPort, never()).sendPostcard(any());
    }

    private void stubSuccessfulOrderPersistence() {
        when(printOrderRepository.save(any())).thenAnswer(inv -> {
            PrintOrder o = inv.getArgument(0);
            return new PrintOrder(orderId, o.coupleId(), o.orderType(), o.status(), o.templateKey(),
                    o.recipientCount(), o.costCents(), o.errorMessage(), o.createdAt(), o.submittedAt(),
                    o.recipients(), o.idempotencyKey(), o.stripeCheckoutSessionId(), o.stripePaymentIntentId(),
                    o.amountChargedCents(), o.amountRefundedCents(), o.returnName(), o.returnAddressLine1(),
                    o.returnAddressLine2(), o.returnCity(), o.returnState(), o.returnZip(), o.cardSize());
        });
        when(printOrderRepository.findById(orderId)).thenReturn(Optional.of(orderWith(List.of())));
    }

    // ── submitBatchAsync: issue #53 async batch + issue #59 refund reconciliation ───────────────

    private PrintOrder processingOrder(List<PrintOrderRecipient> recipients, Integer amountChargedCents) {
        return new PrintOrder(orderId, coupleId, PrintOrderType.SAVE_THE_DATE, PrintOrderStatus.PROCESSING,
                "SAVE_THE_DATE_CLASSIC", recipients.size(), 0, null, LocalDateTime.now(), null,
                recipients, "idem-1", "cs_1", "pi_1", amountChargedCents, 0,
                "Name", "1 Way", null, "City", "IL", "60601", null);
    }

    @Test
    void submitBatchAsync_skipsWhenOrderNotFound() {
        when(printOrderRepository.findById(orderId)).thenReturn(Optional.empty());

        service.submitBatchAsync(orderId);

        verifyNoInteractions(printMailPort);
    }

    @Test
    void submitBatchAsync_skipsWhenOrderNotInProcessingStatus() {
        PrintOrder pending = new PrintOrder(orderId, coupleId, PrintOrderType.SAVE_THE_DATE,
                PrintOrderStatus.PENDING_PAYMENT, "k", 0, 0, null, LocalDateTime.now(), null, List.of(), "i",
                null, null, null, 0, null, null, null, null, null, null, null);
        when(printOrderRepository.findById(orderId)).thenReturn(Optional.of(pending));

        service.submitBatchAsync(orderId);

        verifyNoInteractions(printMailPort);
    }

    @Test
    void submitBatchAsync_sendsPendingRecipientsAndFinalizesAsSubmitted() {
        UUID guestId = UUID.randomUUID();
        var pendingRecipient = new PrintOrderRecipient(UUID.randomUUID(), orderId, guestId, null, "PENDING", null, null, null);
        when(printOrderRepository.findById(orderId))
                .thenReturn(Optional.of(processingOrder(List.of(pendingRecipient), 200)));
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.of(couple()));
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());
        when(guestRepository.findById(guestId)).thenReturn(Optional.of(domesticGuest(guestId, "Guest One")));
        when(printMailPort.sendPostcard(any())).thenReturn("lob_123");

        service.submitBatchAsync(orderId);

        verify(printOrderRepository).updateRecipientOutcome(pendingRecipient.id(), "lob_123", "SUBMITTED", null);
        verify(printOrderRepository).finalizeOrder(eq(orderId), eq(PrintOrderStatus.SUBMITTED), any(), any(), eq(200));
        // Charged 200, sent 200 worth -- no refund due.
        verify(stripePort, never()).refundPayment(any(), anyLong(), any());
    }

    @Test
    void submitBatchAsync_refundsTheDifferenceWhenARecipientFailsAfterCharge() {
        UUID guestId = UUID.randomUUID();
        var pendingRecipient = new PrintOrderRecipient(UUID.randomUUID(), orderId, guestId, null, "PENDING", null, null, null);
        // Charged for 2 postcards (400 cents) but only 1 guest remains to process (simulating one
        // already-excluded guest accounted for elsewhere); this one fails at Lob send time.
        when(printOrderRepository.findById(orderId))
                .thenReturn(Optional.of(processingOrder(List.of(pendingRecipient), 400)));
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.of(couple()));
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());
        when(guestRepository.findById(guestId)).thenReturn(Optional.of(domesticGuest(guestId, "Guest One")));
        when(printMailPort.sendPostcard(any()))
                .thenThrow(new PrintMailPort.PrintMailException("Lob rejected postcard: 422", "Bad address", null));

        service.submitBatchAsync(orderId);

        verify(printOrderRepository).finalizeOrder(eq(orderId), eq(PrintOrderStatus.FAILED), any(), any(), eq(0));
        // Charged 400, sent 0 worth of postcards successfully -- refund the full 400.
        verify(stripePort).refundPayment("pi_1", 400, "print-refund-" + orderId);
        verify(printOrderRepository).recordRefund(orderId, 400);
    }

    @Test
    void submitBatchAsync_neverRefundsTwiceForTheSameOrder() {
        // Defense-in-depth: even if this method somehow ran twice for the same order (the
        // markPaymentConfirmed compare-and-swap is the primary guard against that), a prior
        // recorded refund must block a second one.
        UUID guestId = UUID.randomUUID();
        var pendingRecipient = new PrintOrderRecipient(UUID.randomUUID(), orderId, guestId, null, "PENDING", null, null, null);
        PrintOrder alreadyRefunded = new PrintOrder(orderId, coupleId, PrintOrderType.SAVE_THE_DATE, PrintOrderStatus.PROCESSING,
                "SAVE_THE_DATE_CLASSIC", 1, 0, null, LocalDateTime.now(), null,
                List.of(pendingRecipient), "idem-1", "cs_1", "pi_1", 400, 400,
                "Name", "1 Way", null, "City", "IL", "60601", null);
        when(printOrderRepository.findById(orderId)).thenReturn(Optional.of(alreadyRefunded));
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.of(couple()));
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());
        when(guestRepository.findById(guestId)).thenReturn(Optional.of(domesticGuest(guestId, "Guest One")));
        when(printMailPort.sendPostcard(any()))
                .thenThrow(new PrintMailPort.PrintMailException("Lob rejected postcard: 422", "Bad address", null));

        service.submitBatchAsync(orderId);

        verify(stripePort, never()).refundPayment(any(), anyLong(), any());
    }

    @Test
    void submitBatchAsync_marksRecipientFailedWhenGuestWasDeletedBeforeSend() {
        UUID guestId = UUID.randomUUID();
        var pendingRecipient = new PrintOrderRecipient(UUID.randomUUID(), orderId, guestId, null, "PENDING", null, null, null);
        when(printOrderRepository.findById(orderId))
                .thenReturn(Optional.of(processingOrder(List.of(pendingRecipient), 200)));
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.of(couple()));
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());
        when(guestRepository.findById(guestId)).thenReturn(Optional.empty());

        service.submitBatchAsync(orderId);

        verify(printMailPort, never()).sendPostcard(any());
        verify(printOrderRepository).updateRecipientOutcome(eq(pendingRecipient.id()), eq(null), eq("FAILED"), anyString());
    }

    @Test
    void submitBatchAsync_finalizesAsFailedInsteadOfHangingWhenSomethingUnexpectedThrows() {
        // An unexpected RuntimeException (a DB blip, anything not a PrintMailException) must not
        // leave the order stuck in PROCESSING forever with the couple already charged -- the
        // crash bracket must still finalize it to a terminal state.
        UUID guestId = UUID.randomUUID();
        var pendingRecipient = new PrintOrderRecipient(UUID.randomUUID(), orderId, guestId, null, "PENDING", null, null, null);
        when(printOrderRepository.findById(orderId))
                .thenReturn(Optional.of(processingOrder(List.of(pendingRecipient), 200)));
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.of(couple()));
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());
        when(guestRepository.findById(guestId)).thenThrow(new RuntimeException("simulated DB blip"));

        service.submitBatchAsync(orderId);

        verify(printOrderRepository).finalizeOrder(eq(orderId), eq(PrintOrderStatus.FAILED), any(), any(), eq(0));
    }

    // ── Issue #208: single self-addressed test-proof postcard ───────────────────────────────────

    private CreateTestPrintOrderRequest testProofRequest() {
        return new CreateTestPrintOrderRequest(
                "SAVE_THE_DATE_CLASSIC",
                "The Couple", "1 Return Way", null, "Chicago", "il", "60601", "idem-test-1", null);
    }

    @Test
    void createTestProofOrder_createsPendingPaymentOrderForExactlyOneSelfAddressedPostcard() {
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.of(couple()));
        when(printMailPort.verifyAddress(any())).thenReturn(new AddressVerificationResult(true, null));
        stubSuccessfulOrderPersistence();
        when(stripePort.createOneTimeCheckoutSession(any(), any(), anyLong(), any(), any(), any()))
                .thenReturn(new StripePort.CheckoutSession("cs_test_proof", "https://checkout.stripe.com/c/pay/cs_test_proof#fragment"));

        var result = service.createTestProofOrder(coupleId, testProofRequest());

        // The order is a real PENDING_PAYMENT PrintOrder, honestly typed TEST_PROOF, charged the
        // same 200 cents/postcard as a batch order -- there is no free or discounted path.
        ArgumentCaptor<PrintOrder> orderCaptor = ArgumentCaptor.forClass(PrintOrder.class);
        verify(printOrderRepository).save(orderCaptor.capture());
        assertThat(orderCaptor.getValue().orderType()).isEqualTo(PrintOrderType.TEST_PROOF);
        assertThat(orderCaptor.getValue().status()).isEqualTo(PrintOrderStatus.PENDING_PAYMENT);
        assertThat(orderCaptor.getValue().recipientCount()).isEqualTo(1);
        assertThat(orderCaptor.getValue().amountChargedCents()).isEqualTo(200);
        verify(stripePort).createOneTimeCheckoutSession(any(), any(), eq(200L), any(), any(), any());
        assertThat(result.checkoutUrl()).isEqualTo("https://checkout.stripe.com/c/pay/cs_test_proof#fragment");

        // Exactly one recipient row, with NO guest behind it (the couple themselves), still
        // PENDING -- nothing reaches Lob until Stripe confirms payment.
        ArgumentCaptor<PrintOrderRecipient> recipientCaptor = ArgumentCaptor.forClass(PrintOrderRecipient.class);
        verify(printOrderRepository).appendRecipient(eq(orderId), recipientCaptor.capture());
        assertThat(recipientCaptor.getValue().guestId()).isNull();
        assertThat(recipientCaptor.getValue().deliveryStatus()).isEqualTo("PENDING");
        verify(printMailPort, never()).sendPostcard(any());
    }

    @Test
    void createTestProofOrder_verifiesTheCouplesOwnAddressAndRejectsUndeliverable_beforeCharging() {
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.of(couple()));
        when(printMailPort.verifyAddress(any()))
                .thenReturn(new AddressVerificationResult(false, "This address could not be verified as a valid USPS deliverable address."));

        assertThatThrownBy(() -> service.createTestProofOrder(coupleId, testProofRequest()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("USPS deliverable");

        // Rejected before any durable side-effect: no order row, no recipient row, no charge.
        verify(printOrderRepository, never()).save(any());
        verify(printOrderRepository, never()).appendRecipient(any(), any());
        verifyNoInteractions(stripePort);

        // And the address it verified is the couple's OWN (state uppercased), not a guest's.
        ArgumentCaptor<ToAddress> addressCaptor = ArgumentCaptor.forClass(ToAddress.class);
        verify(printMailPort).verifyAddress(addressCaptor.capture());
        assertThat(addressCaptor.getValue().name()).isEqualTo("The Couple");
        assertThat(addressCaptor.getValue().state()).isEqualTo("IL");
    }

    @Test
    void createTestProofOrder_replaysIdempotentRequest_withoutTouchingStripe() {
        PrintOrder existing = orderWith(List.of());
        when(printOrderRepository.findByCoupleIdAndIdempotencyKey(coupleId, "idem-test-1"))
                .thenReturn(Optional.of(existing));

        var result = service.createTestProofOrder(coupleId, testProofRequest());

        assertThat(result.order()).isEqualTo(existing);
        assertThat(result.checkoutUrl()).isNull();
        verifyNoInteractions(stripePort);
        verify(printOrderRepository, never()).save(any());
    }

    @Test
    void createTestProofOrder_rejectsUnknownTemplateKey_beforeChargingOrPersisting() {
        var req = new CreateTestPrintOrderRequest(
                "SAVE_THE_DATE_HACKER",
                "The Couple", "1 Return Way", null, "Chicago", "il", "60601", "idem-test-2", null);

        assertThatThrownBy(() -> service.createTestProofOrder(coupleId, req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("template");

        verify(printOrderRepository, never()).save(any());
        verifyNoInteractions(stripePort);
    }

    @Test
    void submitBatchAsync_sendsTestProofToTheCouplesOwnReturnAddress() {
        // A TEST_PROOF recipient has no guestId; the batch must address it to the order's
        // persisted return_* block and never consult the guest repository for it.
        var selfRecipient = new PrintOrderRecipient(UUID.randomUUID(), orderId, null, null, "PENDING", null, null, null);
        PrintOrder proofOrder = new PrintOrder(orderId, coupleId, PrintOrderType.TEST_PROOF, PrintOrderStatus.PROCESSING,
                "SAVE_THE_DATE_CLASSIC", 1, 0, null, LocalDateTime.now(), null,
                List.of(selfRecipient), "idem-test-1", "cs_1", "pi_1", 200, 0,
                "The Couple", "1 Return Way", "Apt 2", "Chicago", "IL", "60601", null);
        when(printOrderRepository.findById(orderId)).thenReturn(Optional.of(proofOrder));
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.of(couple()));
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());
        when(printMailPort.sendPostcard(any())).thenReturn("lob_proof_1");

        service.submitBatchAsync(orderId);

        ArgumentCaptor<PrintMailPort.PostcardRequest> postcardCaptor =
                ArgumentCaptor.forClass(PrintMailPort.PostcardRequest.class);
        verify(printMailPort).sendPostcard(postcardCaptor.capture());
        ToAddress to = postcardCaptor.getValue().to();
        assertThat(to.name()).isEqualTo("The Couple");
        assertThat(to.addressLine1()).isEqualTo("1 Return Way");
        assertThat(to.addressLine2()).isEqualTo("Apt 2");
        assertThat(to.city()).isEqualTo("Chicago");
        assertThat(to.state()).isEqualTo("IL");
        assertThat(to.zip()).isEqualTo("60601");
        verifyNoInteractions(guestRepository);

        verify(printOrderRepository).updateRecipientOutcome(selfRecipient.id(), "lob_proof_1", "SUBMITTED", null);
        verify(printOrderRepository).finalizeOrder(eq(orderId), eq(PrintOrderStatus.SUBMITTED), any(), any(), eq(200));
        // Charged 200, sent 200 worth -- no refund due.
        verify(stripePort, never()).refundPayment(any(), anyLong(), any());
    }
}
