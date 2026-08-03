package com.altarwed.domain.model.email;

/**
 * The touches of the couple activation win-back sequence (issue #551).
 *
 * A couple who registers and never publishes a wedding website is the platform's largest
 * retention leak: they received the welcome mail and then nothing, ever. This enum is the single
 * source of truth for the sequence: how many days after signup each nudge fires, which
 * {@link EmailType} the durable outbox row carries, and the stable string persisted in the
 * couple_winback_sends dedupe table.
 *
 * Three touches, deliberately: an early "you are two clicks away" reminder, a mid-week nudge with
 * the practical reason to finish, and a final three-week check-in that leaves the door open rather
 * than nagging. After DAY_21 the sequence stops; the couple never hears from it again.
 *
 * The name is persisted (couple_winback_sends.touch) and matched by a CHECK constraint, so
 * renaming a constant would orphan every existing dedupe row and re-send an already-sent nudge.
 */
public enum CoupleWinbackTouch {

    DAY_2(2, EmailType.COUPLE_WINBACK_DAY_2),
    DAY_7(7, EmailType.COUPLE_WINBACK_DAY_7),
    DAY_21(21, EmailType.COUPLE_WINBACK_DAY_21);

    private final int daysAfterSignup;
    private final EmailType emailType;

    CoupleWinbackTouch(int daysAfterSignup, EmailType emailType) {
        this.daysAfterSignup = daysAfterSignup;
        this.emailType = emailType;
    }

    /** Days after the couple registered that this nudge becomes due. */
    public int daysAfterSignup() {
        return daysAfterSignup;
    }

    /** The outbox discriminator this touch enqueues under. */
    public EmailType emailType() {
        return emailType;
    }
}
