package com.altarwed.domain.model;

/**
 * Lifecycle status of a single mailed postcard, derived from Lob webhook events (issue #52)
 * and from the existing polling fallback ({@code LobPrintMailAdapter.deriveDeliveryStatus},
 * issue #59). Ordered loosely from least to most informative; {@link #rank()} lets the webhook
 * processor ignore an out-of-order event that would downgrade a more terminal state (e.g. a
 * delayed "mailed" event arriving after "delivered"), mirroring {@code EmailDeliveryStatus}'s
 * role for Resend webhooks.
 *
 * <p>{@link #label()} matches Lob's own {@code tracking_events[].name} strings (Title Case,
 * human-readable) so polling-derived and webhook-derived statuses share one vocabulary in the
 * {@code delivery_status} column and rank consistently regardless of which mechanism wrote them.
 */
public enum LobDeliveryStatus {
    // Dispatched to the carrier, no USPS scan yet (LobPrintMailAdapter's "Sent" fallback, set
    // once Lob has an expected_delivery_date but before the first tracking event).
    SENT(0, "Sent"),
    IN_TRANSIT(1, "In Transit"),
    // A detour (address correction, missort), not forward progress -- same rank as IN_TRANSIT.
    RE_ROUTED(1, "Re-routed"),
    IN_LOCAL_AREA(2, "In Local Area"),
    PROCESSED_FOR_DELIVERY(3, "Processed for Delivery"),
    // Both terminal outcomes for a single mail piece; same rank so whichever actually happened
    // (by event timestamp) wins rather than one structurally overriding the other.
    DELIVERED(4, "Delivered"),
    RETURNED_TO_SENDER(4, "Returned to Sender");

    private final int rank;
    private final String label;

    LobDeliveryStatus(int rank, String label) {
        this.rank = rank;
        this.label = label;
    }

    public int rank() {
        return rank;
    }

    public String label() {
        return label;
    }

    /**
     * Rank of a stored/incoming status label, case-insensitive. Unrecognized labels (a status
     * string this enum's vocabulary guess did not anticipate, from either mechanism) rank as -1 --
     * lower than every known status -- so an unrecognized existing value is always freely
     * overwritable, and an unrecognized incoming value is always freely written. That fails toward
     * "show the latest thing we were told" rather than "get stuck on a stale status forever",
     * which is the safer failure mode for a display-only delivery status.
     */
    public static int rankOf(String label) {
        if (label == null) return -1;
        for (LobDeliveryStatus s : values()) {
            if (s.label.equalsIgnoreCase(label)) return s.rank;
        }
        return -1;
    }
}
