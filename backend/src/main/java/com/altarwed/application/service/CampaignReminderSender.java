package com.altarwed.application.service;

import com.altarwed.domain.model.Guest;
import com.altarwed.domain.model.RsvpInviteToken;
import com.altarwed.domain.port.GuestRepository;
import com.altarwed.domain.port.RsvpInviteTokenRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.UUID;

/**
 * The per-guest transactional unit of the date-offset RSVP campaign reminders (issue #458).
 *
 * Deliberately a SEPARATE bean from {@link CampaignReminderService}: the reminder enqueue and the
 * sent-marker stamp must commit together (so a queued reminder is always recorded, and a recorded
 * reminder was always queued), while one guest's failure must NOT roll back the rest of the batch.
 * That is the same split RsvpReminderService uses (non-transactional scheduler calls a transactional
 * GuestService method): a self-invocation of an @Transactional method on the scheduler bean would
 * bypass the proxy and lose the per-guest boundary, so the transactional work lives here where the
 * scheduler reaches it through a real Spring proxy.
 */
@Service
public class CampaignReminderSender {

    private final AsyncEmailService asyncEmailService;
    private final GuestRepository guestRepository;
    private final RsvpInviteTokenRepository tokenRepository;

    public CampaignReminderSender(AsyncEmailService asyncEmailService,
                                  GuestRepository guestRepository,
                                  RsvpInviteTokenRepository tokenRepository) {
        this.asyncEmailService = asyncEmailService;
        this.guestRepository = guestRepository;
        this.tokenRepository = tokenRepository;
    }

    /**
     * Mints a fresh RSVP link token for the guest, enqueues the nonresponder reminder, and stamps
     * nonresponder_reminder_sent_at, all in one transaction. A new token is inserted rather than
     * reusing or clearing any existing one, so an emailed invite link keeps working alongside this
     * nudge, and the guest's invite-send cap is untouched (this is a system reminder, not a
     * couple-initiated invite). Expiry tracks the wedding date exactly like a normal invite.
     */
    @Transactional
    public void sendNonresponderReminder(Guest guest, CampaignReminderService.ReminderContext ctx) {
        String rawToken = UUID.randomUUID().toString();
        tokenRepository.save(new RsvpInviteToken(
                null, hash(rawToken), guest.id(),
                GuestService.computeInviteExpiry(ctx.weddingDate(), java.time.LocalDateTime.now()),
                false, null, RsvpInviteToken.SOURCE_INVITE));

        asyncEmailService.sendNonresponderReminderEmail(
                guest.email(), guest.name(), ctx.coupleNames(), ctx.weddingDateDisplay(),
                ctx.venueAddress(), ctx.venueCity(), ctx.venueState(), ctx.ceremonyTime(),
                rawToken, ctx.googleCalendarUrl());

        guestRepository.save(withNonresponderMarker(guest, OffsetDateTime.now()));
    }

    /**
     * Enqueues the attending reminder (venue details, add-to-calendar) and stamps
     * attending_reminder_sent_at in one transaction. No RSVP token: the guest is already ATTENDING,
     * so the reminder prompts no RSVP action.
     */
    @Transactional
    public void sendAttendingReminder(Guest guest, CampaignReminderService.ReminderContext ctx) {
        asyncEmailService.sendAttendingReminderEmail(
                guest.email(), guest.name(), ctx.coupleNames(), ctx.weddingDateDisplay(),
                ctx.venueAddress(), ctx.venueCity(), ctx.venueState(), ctx.ceremonyTime(),
                ctx.googleCalendarUrl());

        guestRepository.save(withAttendingMarker(guest, OffsetDateTime.now()));
    }

    private static Guest withNonresponderMarker(Guest g, OffsetDateTime sentAt) {
        return new Guest(
                g.id(), g.coupleId(), g.name(), g.email(), g.phone(),
                g.rsvpStatus(), g.plusOneAllowed(), g.plusOneName(),
                g.dietaryRestrictions(), g.songRequest(),
                g.tableNumber(), g.side(), g.notes(),
                g.mailLine1(), g.mailCity(), g.mailState(), g.mailZip(), g.mailCountry(),
                g.noteForCouple(), g.inviteSendCount(),
                g.inviteSentAt(), g.saveTheDateSentAt(), g.respondedAt(), g.remindAt(),
                g.createdAt(), g.updatedAt(),
                g.partyId(), g.partyName(), g.partyContact(),
                g.sheetSyncId(), g.syncedFromSheet(),
                sentAt, g.attendingReminderSentAt());
    }

    private static Guest withAttendingMarker(Guest g, OffsetDateTime sentAt) {
        return new Guest(
                g.id(), g.coupleId(), g.name(), g.email(), g.phone(),
                g.rsvpStatus(), g.plusOneAllowed(), g.plusOneName(),
                g.dietaryRestrictions(), g.songRequest(),
                g.tableNumber(), g.side(), g.notes(),
                g.mailLine1(), g.mailCity(), g.mailState(), g.mailZip(), g.mailCountry(),
                g.noteForCouple(), g.inviteSendCount(),
                g.inviteSentAt(), g.saveTheDateSentAt(), g.respondedAt(), g.remindAt(),
                g.createdAt(), g.updatedAt(),
                g.partyId(), g.partyName(), g.partyContact(),
                g.sheetSyncId(), g.syncedFromSheet(),
                g.nonresponderReminderSentAt(), sentAt);
    }

    // SHA-256 hex of the raw token; only the hash is persisted, matching the RSVP invite flow.
    private static String hash(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }
}
