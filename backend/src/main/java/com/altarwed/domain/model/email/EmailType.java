package com.altarwed.domain.model.email;

/**
 * Discriminator for a durable outbox row: which EmailPort operation the row
 * represents. Stored in the email_outbox.email_type column and used by the
 * outbox sender to pick the matching payload record and EmailPort call.
 *
 * Adding a new transactional email means adding a value here, a payload record
 * in {@link OutboxPayloads}, an enqueue method on AsyncEmailService, and a
 * dispatch branch in EmailOutboxSender. Keeping the name stable matters: it is
 * persisted, so a rename would orphan in-flight rows written by the old code.
 */
public enum EmailType {
    PASSWORD_RESET,
    WELCOME,
    ACCOUNT_DELETED,
    WEDDING_PUBLISHED,
    RSVP_INVITE,
    SAVE_THE_DATE_BATCH,
    RSVP_INVITE_BATCH,
    RSVP_NOTIFICATION_TO_COUPLE,
    VENDOR_WELCOME,
    VENDOR_VERIFIED,
    VENDOR_REGISTRATION_ALERT,
    COUPLE_WEBSITE_CREATED_ALERT,
    VENDOR_INQUIRY,
    VENDOR_INQUIRY_CONFIRMATION
}
