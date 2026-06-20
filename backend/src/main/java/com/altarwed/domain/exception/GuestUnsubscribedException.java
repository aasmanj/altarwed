package com.altarwed.domain.exception;

/**
 * Thrown when a couple tries to email-invite a guest who is suppressed for them
 * (a per-couple unsubscribe, or a global bounce/spam-complaint). We honour the
 * suppression for RSVP invites too, so the couple must invite that guest another way
 * (a printed card, a text). An unsubscribed guest comes back by RSVPing on the wedding
 * site. Maps to a 422 with guidance.
 */
public class GuestUnsubscribedException extends RuntimeException {
    public GuestUnsubscribedException(String message) {
        super(message);
    }
}
