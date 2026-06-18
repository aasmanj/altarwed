package com.altarwed.domain.model;

/**
 * A single recipient of a bulk email send: the address plus the personalisation
 * fields that vary per recipient (currently just the display name). Shared content
 * (couple names, wedding date, URL) is passed alongside the recipient list, so this
 * stays a tiny value object that the email port can fan out into a batch request.
 */
public record EmailRecipient(String email, String name) {
}
