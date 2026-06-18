package com.altarwed.domain.model;

import java.util.UUID;

/**
 * A single recipient of a bulk email send: the address plus the personalisation
 * fields that vary per recipient (display name) and the guest id used to tag the
 * outgoing message. The tag lets the Resend delivery webhook map a delivery/bounce
 * event back to this guest. Shared content (couple names, wedding date, URL) is
 * passed alongside the recipient list, so this stays a tiny value object that the
 * email port can fan out into a batch request.
 */
public record EmailRecipient(String email, String name, UUID guestId) {
}
