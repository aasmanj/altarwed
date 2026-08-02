package com.altarwed.domain.model.email;

/**
 * One step in the couple win-back sequence (issue #551): the warm nudges a couple receives
 * after signing up while they have not yet published their wedding website.
 *
 * A pure discriminator, exactly like {@link EmailType}: the value is persisted in the
 * couple_winback_touches.touch column (the send-once dedupe key) and carried in the outbox
 * payload so the sender can render the right copy. The name is stable and must never be
 * renamed, because a rename would orphan already-recorded rows and re-open a couple to a
 * touch they already received.
 *
 * The scheduling math (which touch is due for a given signup age) lives in
 * CoupleWinbackService, not here, so this stays a plain identity the domain and persistence
 * layers can share without pulling in time logic.
 */
public enum CoupleWinbackTouch {
    // Day 2: "your website is one step away" -- link straight to the editor.
    DAY_2,
    // Day 7: "3 things couples do first" -- guest list, save-the-dates, seating.
    DAY_7,
    // Day 21: "your wedding page is waiting" -- social-proof framing. The FINAL touch;
    // the sequence stops here so a couple is never nagged forever.
    DAY_21
}
