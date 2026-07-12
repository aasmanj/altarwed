package com.altarwed.domain.model;

import java.util.UUID;

/**
 * A single recipient of a bulk RSVP invite send. Like {@link EmailRecipient} it carries the
 * address, display name, and guest id used to tag the outgoing message so the Resend delivery
 * webhook can map a delivery/bounce event back to this guest. Unlike a save-the-date, every
 * RSVP invite link is per-guest, so this record also carries the recipient's own raw rsvpToken.
 * Shared content (couple names, wedding date, reply-to) is identical for every recipient and is
 * passed alongside the list, so the email port can fan the whole batch out through Resend's
 * /emails/batch endpoint instead of one API call per guest.
 */
public record RsvpInviteRecipient(String email, String name, UUID guestId, String rsvpToken) {
}
