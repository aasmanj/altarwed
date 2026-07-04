package com.altarwed.application.service;

import com.altarwed.application.dto.LobWebhookEvent;
import com.altarwed.domain.port.PrintOrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link LobWebhookService}, which applies Lob mail-piece lifecycle webhook
 * events to print_order_recipients (issue #52). Locks in the decisions that are easy to get
 * subtly wrong: which events we track, how out-of-order/duplicate/unknown events are handled,
 * and that a rejected/superseded event never writes.
 */
@ExtendWith(MockitoExtension.class)
class LobWebhookServiceTest {

    @Mock private PrintOrderRepository printOrderRepository;

    private LobWebhookService service() {
        return new LobWebhookService(printOrderRepository);
    }

    private LobWebhookEvent event(String eventTypeId, String postcardId, String dateCreated) {
        return new LobWebhookEvent(
                "evt_1", dateCreated,
                new LobWebhookEvent.EventType(eventTypeId),
                new LobWebhookEvent.Body(postcardId, null, null));
    }

    @Test
    void delivered_appliesForAKnownPostcard() {
        UUID recipientId = UUID.randomUUID();
        when(printOrderRepository.findRecipientLobStatus("psc_1")).thenReturn(Optional.of(
                new PrintOrderRepository.RecipientLobStatus(recipientId, "In Transit", LocalDateTime.now().minusHours(1))));

        service().process(event("postcard.delivered", "psc_1", "2026-06-18T12:00:00.000Z"));

        verify(printOrderRepository).applyLobDeliveryEvent(
                eq(recipientId), eq("Delivered"), any(LocalDateTime.class), isNull(), isNull());
    }

    @Test
    void unknownPostcardId_isANoOp() {
        when(printOrderRepository.findRecipientLobStatus("psc_ghost")).thenReturn(Optional.empty());

        service().process(event("postcard.delivered", "psc_ghost", "2026-06-18T12:00:00.000Z"));

        verify(printOrderRepository, never()).applyLobDeliveryEvent(any(), anyString(), any(), any(), any());
    }

    @Test
    void unknownEventType_isIgnored() {
        service().process(event("postcard.rendered_pdf", "psc_1", "2026-06-18T12:00:00.000Z"));

        verifyNoInteractions(printOrderRepository);
    }

    @Test
    void lateInTransit_doesNotOverwriteDelivered() {
        // A "in_transit" arriving after "delivered" must not regress the terminal state.
        UUID recipientId = UUID.randomUUID();
        when(printOrderRepository.findRecipientLobStatus("psc_2")).thenReturn(Optional.of(
                new PrintOrderRepository.RecipientLobStatus(recipientId, "Delivered", LocalDateTime.now())));

        service().process(event("postcard.in_transit", "psc_2", "2026-06-18T12:00:00.000Z"));

        verify(printOrderRepository, never()).applyLobDeliveryEvent(any(), anyString(), any(), any(), any());
    }

    @Test
    void redeliveredEventAtOrBeforeLastApplied_isIgnoredAsDuplicate() {
        UUID recipientId = UUID.randomUUID();
        LocalDateTime lastApplied = LocalDateTime.of(2026, 6, 18, 12, 0);
        when(printOrderRepository.findRecipientLobStatus("psc_3")).thenReturn(Optional.of(
                new PrintOrderRepository.RecipientLobStatus(recipientId, "In Transit", lastApplied)));

        // Same rank (IN_TRANSIT), timestamp not after the last applied event.
        service().process(event("postcard.in_transit", "psc_3", "2026-06-18T12:00:00.000Z"));

        verify(printOrderRepository, never()).applyLobDeliveryEvent(any(), anyString(), any(), any(), any());
    }

    @Test
    void firstEventForARecipientWithNoPriorLobEvent_isAlwaysApplied() {
        // A recipient whose delivery_status came only from order-submission (PENDING/SUBMITTED,
        // not this enum's vocabulary) has lastLobEventAt == null; the very first real Lob
        // tracking event must still apply regardless of timestamp.
        UUID recipientId = UUID.randomUUID();
        when(printOrderRepository.findRecipientLobStatus("psc_4")).thenReturn(Optional.of(
                new PrintOrderRepository.RecipientLobStatus(recipientId, "SUBMITTED", null)));

        service().process(event("postcard.mailed", "psc_4", "2026-06-18T12:00:00.000Z"));

        verify(printOrderRepository).applyLobDeliveryEvent(
                eq(recipientId), eq("Sent"), any(LocalDateTime.class), isNull(), isNull());
    }

    @Test
    void returnedToSender_appliesAndCarriesTrackingFields() {
        UUID recipientId = UUID.randomUUID();
        when(printOrderRepository.findRecipientLobStatus("psc_5")).thenReturn(Optional.of(
                new PrintOrderRepository.RecipientLobStatus(recipientId, "In Transit", LocalDateTime.now().minusDays(1))));
        LobWebhookEvent event = new LobWebhookEvent(
                "evt_2", "2026-06-18T12:00:00.000Z",
                new LobWebhookEvent.EventType("postcard.returned_to_sender"),
                new LobWebhookEvent.Body("psc_5", "9400111899223197428490", "2026-06-20"));

        service().process(event);

        ArgumentCaptor<LocalDate> dateCaptor = ArgumentCaptor.forClass(LocalDate.class);
        verify(printOrderRepository).applyLobDeliveryEvent(
                eq(recipientId), eq("Returned to Sender"), any(LocalDateTime.class),
                eq("9400111899223197428490"), dateCaptor.capture());
        assertThat(dateCaptor.getValue()).isEqualTo(LocalDate.of(2026, 6, 20));
    }

    @Test
    void malformedPayload_isDiscarded() {
        service().process(new LobWebhookEvent("evt_3", null, null, null));
        verifyNoInteractions(printOrderRepository);
    }

    @Test
    void missingPostcardId_isDiscarded() {
        LobWebhookEvent event = new LobWebhookEvent(
                "evt_4", "2026-06-18T12:00:00.000Z",
                new LobWebhookEvent.EventType("postcard.delivered"),
                new LobWebhookEvent.Body(null, null, null));

        service().process(event);

        verifyNoInteractions(printOrderRepository);
    }
}
