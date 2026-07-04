package com.altarwed.application.service;

import com.altarwed.application.dto.LobWebhookEvent;
import com.altarwed.domain.model.LobDeliveryStatus;
import com.altarwed.domain.port.PrintOrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.Optional;

/**
 * Applies Lob mail-piece lifecycle webhook events to {@code print_order_recipients} (issue #52).
 * The webhook controller verifies the signature and parses the payload; this service owns the
 * domain decisions -- which events we track and how out-of-order/redelivered events are
 * reconciled -- mirroring {@link EmailDeliveryService}'s role for Resend webhooks exactly.
 *
 * Deliberately does not touch {@code PrintOrderService} or {@code LobPrintMailAdapter} (scope
 * boundary for issue #52): reads and writes go straight through {@link PrintOrderRepository}'s
 * dedicated Lob-webhook methods, which return/accept only the fields this decision needs, never
 * the full couple-facing aggregate.
 */
@Service
public class LobWebhookService {

    private static final Logger log = LoggerFactory.getLogger(LobWebhookService.class);

    // Lob event_type.id -> our lifecycle status. Events not in this map (postcard.created,
    // postcard.rendered_pdf, postcard.rendered_thumbnails, postcard.deleted, ...) are
    // acknowledged and ignored, same as EmailDeliveryService's EVENT_STATUS.
    //
    // NOTE: these event_type.id strings are this implementation's best-effort match to Lob's
    // actual webhook taxonomy (not validated against a live Lob account). If delivery status
    // never updates in practice, confirm the real ids via a Lob dashboard test webhook and
    // check backend logs for "lob webhook event ignored, type=..." to see what Lob actually sent.
    private static final Map<String, LobDeliveryStatus> EVENT_STATUS = Map.of(
            "postcard.mailed", LobDeliveryStatus.SENT,
            "postcard.in_transit", LobDeliveryStatus.IN_TRANSIT,
            "postcard.re-routed", LobDeliveryStatus.RE_ROUTED,
            "postcard.in_local_area", LobDeliveryStatus.IN_LOCAL_AREA,
            "postcard.processed_for_delivery", LobDeliveryStatus.PROCESSED_FOR_DELIVERY,
            "postcard.delivered", LobDeliveryStatus.DELIVERED,
            "postcard.returned_to_sender", LobDeliveryStatus.RETURNED_TO_SENDER
    );

    private final PrintOrderRepository printOrderRepository;

    public LobWebhookService(PrintOrderRepository printOrderRepository) {
        this.printOrderRepository = printOrderRepository;
    }

    public void process(LobWebhookEvent event) {
        if (event == null || event.eventType() == null || event.eventType().id() == null || event.body() == null) {
            log.warn("lob webhook discarded, reason=malformed payload");
            return;
        }
        LobDeliveryStatus status = EVENT_STATUS.get(event.eventType().id());
        if (status == null) {
            log.debug("lob webhook event ignored, type={}", event.eventType().id());
            return;
        }
        String lobPostcardId = event.body().id();
        if (lobPostcardId == null || lobPostcardId.isBlank()) {
            log.warn("lob webhook discarded, reason=missing postcard id, type={}", event.eventType().id());
            return;
        }

        Optional<PrintOrderRepository.RecipientLobStatus> existing =
                printOrderRepository.findRecipientLobStatus(lobPostcardId);
        if (existing.isEmpty()) {
            // Acceptance criterion: unknown postcard ids are a no-op, not an error. Lob may
            // redeliver events after a recipient row is deleted (couple deletes the order), or
            // this instance's account may receive events for a postcard id in a shared test-mode
            // sandbox that isn't ours.
            log.debug("lob webhook event ignored, reason=unknown postcard id");
            return;
        }

        PrintOrderRepository.RecipientLobStatus cur = existing.get();
        LocalDateTime eventAt = parseEventTime(event.dateCreated());

        // Drop events that would regress a more terminal outcome or duplicate the current one.
        // Lob retries webhooks and does not guarantee ordering, so a late "in_transit" must not
        // overwrite a "delivered", and a redelivered event must not churn the row. Identical
        // reasoning/shape to EmailDeliveryService.upsert's regresses/duplicate guard.
        int curRank = LobDeliveryStatus.rankOf(cur.deliveryStatus());
        boolean regresses = status.rank() < curRank;
        boolean duplicate = status.rank() == curRank
                && cur.lastLobEventAt() != null && !eventAt.isAfter(cur.lastLobEventAt());
        if (regresses || duplicate) {
            log.debug("lob webhook event superseded, keeping status={}, incoming={}", cur.deliveryStatus(), status.label());
            return;
        }

        String trackingNumber = nonBlank(event.body().trackingNumber());
        LocalDate expectedDeliveryDate = parseLocalDate(event.body().expectedDeliveryDate());
        printOrderRepository.applyLobDeliveryEvent(
                cur.recipientId(), status.label(), eventAt, trackingNumber, expectedDeliveryDate);

        // Returned to sender is a bad-address signal the couple should notice; other lifecycle
        // events are high-volume happy-path progress. WARN vs DEBUG, matching EmailDeliveryService's
        // bounce-vs-delivered split. No guest/address PII: only internal ids + the Lob postcard id.
        if (status == LobDeliveryStatus.RETURNED_TO_SENDER) {
            log.warn("postcard returned to sender, recipientId={}, lobPostcardId={}", cur.recipientId(), lobPostcardId);
        } else {
            log.debug("lob delivery event recorded, status={}, recipientId={}", status.label(), cur.recipientId());
        }
    }

    private static String nonBlank(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    private static LocalDate parseLocalDate(String raw) {
        String s = nonBlank(raw);
        if (s == null) return null;
        try {
            // Lob returns an ISO date (occasionally with a time component); take the date part,
            // matching LobPrintMailAdapter.parseLocalDate's exact handling of the same field.
            return LocalDate.parse(s.length() > 10 ? s.substring(0, 10) : s);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private static LocalDateTime parseEventTime(String raw) {
        if (raw == null || raw.isBlank()) return LocalDateTime.now();
        try {
            return OffsetDateTime.parse(raw).toLocalDateTime();
        } catch (RuntimeException ex) {
            return LocalDateTime.now();
        }
    }
}
