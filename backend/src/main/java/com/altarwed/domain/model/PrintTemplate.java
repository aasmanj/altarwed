package com.altarwed.domain.model;

/**
 * The closed set of postcard designs a couple may order (issue #352). templateKey on a create
 * request is fully couple-controlled from the client: it selects a layout branch + headline in the
 * Lob adapter and is concatenated into Lob's postcard description metadata. It must therefore be
 * validated server-side against this allowlist rather than trusted, so a nonsense or mismatched
 * value is a clean rejection rather than a silently-accepted order that renders a garbage card.
 *
 * This enum is the single source of truth for the allowed keys; validation happens once, in
 * {@code PrintOrderService.createOrder}, and an unknown value becomes a 400 there.
 *
 * Naming contract: {orderType}_{style}, where style is CLASSIC (cream + gold, no photo) or PHOTO
 * (the couple's hero image). The Lob adapter keys its layout off the SAVE_THE_DATE prefix and the
 * _PHOTO suffix, so keep any new member consistent with that shape.
 */
public enum PrintTemplate {
    SAVE_THE_DATE_CLASSIC,
    SAVE_THE_DATE_PHOTO,
    INVITATION_CLASSIC,
    INVITATION_PHOTO;

    /**
     * True only when key is an exact, case-sensitive match for an allowed template. The web client
     * always sends one of the canonical values above, so the allowlist stays strict on purpose:
     * null, blank, wrong case, or any injected value is rejected rather than coerced.
     */
    public static boolean isAllowed(String key) {
        if (key == null) {
            return false;
        }
        for (PrintTemplate template : values()) {
            if (template.name().equals(key)) {
                return true;
            }
        }
        return false;
    }
}
