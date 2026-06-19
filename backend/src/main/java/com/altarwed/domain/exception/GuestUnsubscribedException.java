package com.altarwed.domain.exception;

/**
 * Thrown when a couple tries to email-invite a guest whose address is on the
 * suppression list (unsubscribed, bounced, or spam-complained). We honour the
 * suppression for RSVP invites too, so the couple must invite that guest another
 * way (physical card, the public find-your-invitation page) or resubscribe them if
 * they asked. Maps to a 422 with guidance.
 */
public class GuestUnsubscribedException extends RuntimeException {
    public GuestUnsubscribedException(String message) {
        super(message);
    }
}
