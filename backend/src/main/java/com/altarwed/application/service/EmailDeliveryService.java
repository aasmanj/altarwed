package com.altarwed.application.service;

import com.altarwed.application.dto.GuestDeliverySummary;
import com.altarwed.application.dto.ResendWebhookEvent;
import com.altarwed.domain.model.EmailDelivery;
import com.altarwed.domain.model.EmailDeliveryStatus;
import com.altarwed.domain.port.EmailDeliveryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Applies Resend delivery webhook events to the email_delivery log and keeps the
 * suppression list current. The webhook controller verifies the signature and
 * parses the payload; this service owns the domain decisions: which events we
 * track, how out-of-order events are reconciled, and when a recipient is
 * suppressed (permanent bounce or spam complaint).
 *
 * Email-type tag values match the {@code emailType} strings the adapter logs/sends
 * with ("save-the-date", "rsvp-invite").
 */
@Service
public class EmailDeliveryService {

    private static final Logger log = LoggerFactory.getLogger(EmailDeliveryService.class);

    public static final String TYPE_SAVE_THE_DATE = "save-the-date";
    public static final String TYPE_RSVP_INVITE = "rsvp-invite";

    // Resend event type -> our lifecycle status. Events not in this map
    // (email.opened, email.clicked, contact.*, domain.*) are acknowledged and ignored.
    private static final Map<String, EmailDeliveryStatus> EVENT_STATUS = Map.of(
            "email.sent", EmailDeliveryStatus.SENT,
            "email.delivery_delayed", EmailDeliveryStatus.DELAYED,
            "email.delivered", EmailDeliveryStatus.DELIVERED,
            "email.complained", EmailDeliveryStatus.COMPLAINED,
            "email.bounced", EmailDeliveryStatus.BOUNCED
    );

    private final EmailDeliveryRepository deliveryRepository;
    private final EmailSuppressionService suppressionService;

    public EmailDeliveryService(EmailDeliveryRepository deliveryRepository,
                                EmailSuppressionService suppressionService) {
        this.deliveryRepository = deliveryRepository;
        this.suppressionService = suppressionService;
    }

    @Transactional
    public void process(ResendWebhookEvent event) {
        if (event == null || event.type() == null || event.data() == null) {
            log.warn("resend webhook discarded, reason=malformed payload");
            return;
        }
        EmailDeliveryStatus status = EVENT_STATUS.get(event.type());
        if (status == null) {
            log.debug("resend webhook event ignored, type={}", event.type());
            return;
        }
        String emailId = event.data().emailId();
        if (emailId == null || emailId.isBlank()) {
            log.warn("resend webhook discarded, reason=missing email_id, type={}", event.type());
            return;
        }

        Map<String, String> tags = event.data().tags() != null ? event.data().tags() : Map.of();
        UUID guestId = parseUuid(tags.get("guest_id"));
        UUID coupleId = parseUuid(tags.get("couple_id"));
        String emailType = tags.getOrDefault("email_type", event.type());
        String recipientHash = recipientHash(event.data().to());
        LocalDateTime eventAt = parseEventTime(event.createdAt());

        String bounceType = event.data().bounce() != null ? event.data().bounce().type() : null;
        String bounceSubtype = event.data().bounce() != null ? event.data().bounce().subType() : null;

        upsert(emailId, guestId, coupleId, emailType, recipientHash, status, bounceType, bounceSubtype, eventAt);

        // Hard bounces and spam complaints must never be emailed again: keeping them
        // on the send list degrades domain reputation and inflates future bounce
        // rates. Transient (soft) bounces are retryable, so we do not suppress them.
        boolean permanentBounce = status == EmailDeliveryStatus.BOUNCED && "Permanent".equalsIgnoreCase(bounceType);
        boolean complaint = status == EmailDeliveryStatus.COMPLAINED;
        if ((permanentBounce || complaint) && recipientHash != null) {
            // Bounces and complaints are address-level deliverability facts: suppress them
            // GLOBALLY (across every couple) to protect the shared sending reputation.
            suppressionService.suppressGlobal(recipientHash, complaint ? "COMPLAINT" : "BOUNCE");
        }

        // Bounces/complaints are recoverable per-item failures the couple may need to
        // act on (fix a typo'd address), so surface them at WARN. Delivered/delayed/sent
        // are high-volume happy-path events: DEBUG to keep App Insights ingest cheap on
        // a thousand-guest send.
        if (status == EmailDeliveryStatus.BOUNCED) {
            log.warn("email bounced, type={}, bounceType={}, bounceSubtype={}, guestId={}, coupleId={}",
                    emailType, bounceType, bounceSubtype, guestId, coupleId);
        } else if (status == EmailDeliveryStatus.COMPLAINED) {
            log.warn("email complaint recorded, type={}, guestId={}, coupleId={}", emailType, guestId, coupleId);
        } else {
            log.debug("email delivery event recorded, type={}, status={}, guestId={}", emailType, status, guestId);
        }
    }

    private void upsert(String emailId, UUID guestId, UUID coupleId, String emailType,
                        String recipientHash, EmailDeliveryStatus status,
                        String bounceType, String bounceSubtype, LocalDateTime eventAt) {
        Optional<EmailDelivery> existing = deliveryRepository.findByResendEmailId(emailId);
        if (existing.isEmpty()) {
            deliveryRepository.save(new EmailDelivery(
                    null, emailId, guestId, coupleId, emailType, recipientHash,
                    status, bounceType, bounceSubtype, eventAt, null, eventAt));
            return;
        }

        EmailDelivery cur = existing.get();
        // Drop events that would regress a more terminal outcome or duplicate the
        // current one. Resend retries webhooks and does not guarantee ordering, so
        // a late "delivered" must not overwrite a "bounced", and a redelivered event
        // must not churn the row.
        boolean regresses = status.rank() < cur.status().rank();
        boolean duplicate = status.rank() == cur.status().rank() && !eventAt.isAfter(cur.lastEventAt());
        if (regresses || duplicate) {
            log.debug("resend webhook event superseded, keeping status={}, incoming={}", cur.status(), status);
            return;
        }

        deliveryRepository.save(new EmailDelivery(
                cur.id(), cur.resendEmailId(),
                guestId != null ? guestId : cur.guestId(),
                coupleId != null ? coupleId : cur.coupleId(),
                emailType, recipientHash != null ? recipientHash : cur.recipientEmailHash(),
                status, bounceType, bounceSubtype, eventAt, cur.createdAt(), eventAt));
    }

    /**
     * Latest delivery status per guest for each tracked email type, for the couple's
     * guest-list view. One query reduced in memory; a couple's guest count is bounded.
     */
    @Transactional(readOnly = true)
    public Map<UUID, GuestDeliverySummary> deliveryStatusesByGuest(UUID coupleId) {
        List<EmailDelivery> rows = deliveryRepository.findByCoupleId(coupleId);
        Map<UUID, EmailDelivery> latestStd = new HashMap<>();
        Map<UUID, EmailDelivery> latestInvite = new HashMap<>();
        for (EmailDelivery d : rows) {
            if (d.guestId() == null) continue;
            if (TYPE_SAVE_THE_DATE.equals(d.emailType())) {
                keepLatest(latestStd, d);
            } else if (TYPE_RSVP_INVITE.equals(d.emailType())) {
                keepLatest(latestInvite, d);
            }
        }
        Map<UUID, GuestDeliverySummary> out = new HashMap<>();
        for (UUID guestId : union(latestStd.keySet(), latestInvite.keySet())) {
            EmailDelivery std = latestStd.get(guestId);
            EmailDelivery invite = latestInvite.get(guestId);
            out.put(guestId, new GuestDeliverySummary(
                    std != null ? std.status().name() : null,
                    invite != null ? invite.status().name() : null));
        }
        return out;
    }

    private static void keepLatest(Map<UUID, EmailDelivery> map, EmailDelivery d) {
        EmailDelivery cur = map.get(d.guestId());
        if (cur == null || d.status().rank() > cur.status().rank()
                || (d.status().rank() == cur.status().rank() && d.lastEventAt().isAfter(cur.lastEventAt()))) {
            map.put(d.guestId(), d);
        }
    }

    private static java.util.Set<UUID> union(java.util.Set<UUID> a, java.util.Set<UUID> b) {
        java.util.Set<UUID> all = new java.util.HashSet<>(a);
        all.addAll(b);
        return all;
    }

    private static UUID parseUuid(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return UUID.fromString(raw.trim());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static String recipientHash(List<String> to) {
        if (to == null || to.isEmpty() || to.get(0) == null || to.get(0).isBlank()) return null;
        return EmailSuppressionService.emailHash(to.get(0));
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
