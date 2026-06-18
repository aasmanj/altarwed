package com.altarwed.application.service;

import com.altarwed.application.dto.GuestDeliverySummary;
import com.altarwed.application.dto.ResendWebhookEvent;
import com.altarwed.domain.model.EmailDelivery;
import com.altarwed.domain.model.EmailDeliveryStatus;
import com.altarwed.domain.port.EmailDeliveryRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link EmailDeliveryService}, which applies Resend webhook events
 * to the delivery log. Locks in the decisions that are easy to get subtly wrong:
 * which events we track, how out-of-order/duplicate events are reconciled, and when
 * a recipient is suppressed.
 */
@ExtendWith(MockitoExtension.class)
class EmailDeliveryServiceTest {

    @Mock private EmailDeliveryRepository deliveryRepository;
    @Mock private EmailSuppressionService suppressionService;

    private EmailDeliveryService service() {
        return new EmailDeliveryService(deliveryRepository, suppressionService);
    }

    private ResendWebhookEvent event(String type, String emailId, UUID guestId, UUID coupleId,
                                     String emailType, ResendWebhookEvent.Bounce bounce) {
        Map<String, String> tags = Map.of(
                "guest_id", guestId.toString(),
                "couple_id", coupleId.toString(),
                "email_type", emailType);
        return new ResendWebhookEvent(type, "2026-06-18T12:00:00.000Z",
                new ResendWebhookEvent.Data(emailId, List.of("guest@example.com"), tags, bounce));
    }

    @Test
    void delivered_insertsRowWithDeliveredStatus() {
        UUID guestId = UUID.randomUUID();
        UUID coupleId = UUID.randomUUID();
        when(deliveryRepository.findByResendEmailId("e1")).thenReturn(Optional.empty());

        service().process(event("email.delivered", "e1", guestId, coupleId, "save-the-date", null));

        ArgumentCaptor<EmailDelivery> saved = ArgumentCaptor.forClass(EmailDelivery.class);
        verify(deliveryRepository).save(saved.capture());
        assertThat(saved.getValue().status()).isEqualTo(EmailDeliveryStatus.DELIVERED);
        assertThat(saved.getValue().guestId()).isEqualTo(guestId);
        assertThat(saved.getValue().emailType()).isEqualTo("save-the-date");
        verify(suppressionService, never()).suppress(anyString(), anyString());
    }

    @Test
    void permanentBounce_suppressesRecipient() {
        when(deliveryRepository.findByResendEmailId("e2")).thenReturn(Optional.empty());
        var bounce = new ResendWebhookEvent.Bounce("Permanent", "Suppressed", "on suppression list");

        service().process(event("email.bounced", "e2", UUID.randomUUID(), UUID.randomUUID(), "rsvp-invite", bounce));

        verify(suppressionService).suppress(anyString(), eq("BOUNCE"));
    }

    @Test
    void transientBounce_doesNotSuppress() {
        when(deliveryRepository.findByResendEmailId("e3")).thenReturn(Optional.empty());
        var bounce = new ResendWebhookEvent.Bounce("Transient", "MailboxFull", "try later");

        service().process(event("email.bounced", "e3", UUID.randomUUID(), UUID.randomUUID(), "rsvp-invite", bounce));

        verify(suppressionService, never()).suppress(anyString(), anyString());
    }

    @Test
    void complaint_suppressesRecipient() {
        when(deliveryRepository.findByResendEmailId("e4")).thenReturn(Optional.empty());

        service().process(event("email.complained", "e4", UUID.randomUUID(), UUID.randomUUID(), "save-the-date", null));

        verify(suppressionService).suppress(anyString(), eq("COMPLAINT"));
    }

    @Test
    void lateDelivered_doesNotOverwriteBounced() {
        // A "delivered" arriving after a "bounced" must not regress the terminal state.
        EmailDelivery existingBounced = new EmailDelivery(
                UUID.randomUUID(), "e5", UUID.randomUUID(), UUID.randomUUID(), "save-the-date",
                "hash", EmailDeliveryStatus.BOUNCED, "Permanent", "Suppressed",
                LocalDateTime.now(), LocalDateTime.now(), LocalDateTime.now());
        when(deliveryRepository.findByResendEmailId("e5")).thenReturn(Optional.of(existingBounced));

        service().process(event("email.delivered", "e5", UUID.randomUUID(), UUID.randomUUID(), "save-the-date", null));

        verify(deliveryRepository, never()).save(any());
    }

    @Test
    void unknownEventType_isIgnored() {
        service().process(event("email.opened", "e6", UUID.randomUUID(), UUID.randomUUID(), "save-the-date", null));
        verifyNoInteractions(deliveryRepository);
        verify(suppressionService, never()).suppress(anyString(), anyString());
    }

    @Test
    void deliveryStatusesByGuest_returnsLatestPerType() {
        UUID coupleId = UUID.randomUUID();
        UUID guestA = UUID.randomUUID();
        UUID guestB = UUID.randomUUID();
        EmailDelivery aSent = delivery(guestA, coupleId, "save-the-date", EmailDeliveryStatus.SENT, LocalDateTime.now().minusMinutes(5));
        EmailDelivery aDelivered = delivery(guestA, coupleId, "save-the-date", EmailDeliveryStatus.DELIVERED, LocalDateTime.now());
        EmailDelivery bBounced = delivery(guestB, coupleId, "rsvp-invite", EmailDeliveryStatus.BOUNCED, LocalDateTime.now());
        when(deliveryRepository.findByCoupleId(coupleId)).thenReturn(List.of(aSent, aDelivered, bBounced));

        Map<UUID, GuestDeliverySummary> result = service().deliveryStatusesByGuest(coupleId);

        assertThat(result.get(guestA).saveTheDateDeliveryStatus()).isEqualTo("DELIVERED");
        assertThat(result.get(guestA).inviteDeliveryStatus()).isNull();
        assertThat(result.get(guestB).inviteDeliveryStatus()).isEqualTo("BOUNCED");
    }

    private EmailDelivery delivery(UUID guestId, UUID coupleId, String type, EmailDeliveryStatus status, LocalDateTime at) {
        return new EmailDelivery(UUID.randomUUID(), UUID.randomUUID().toString(), guestId, coupleId, type,
                "hash", status, null, null, at, at, at);
    }
}
