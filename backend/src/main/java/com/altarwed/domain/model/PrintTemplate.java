package com.altarwed.domain.model;

/**
 * The closed set of postcard designs a couple may order (issue #352, extended #362). templateKey
 * on a create request is fully couple-controlled from the client: it selects a layout branch +
 * headline in the Lob adapter and is concatenated into Lob's postcard description metadata. It must
 * therefore be validated server-side against this allowlist rather than trusted, so a nonsense or
 * mismatched value is a clean rejection rather than a silently-accepted order that renders a garbage
 * card.
 *
 * This enum is the single source of truth for the allowed base keys; validation happens once, in
 * {@code PrintOrderService.createOrder}, and an unknown value becomes a 400 there.
 *
 * Naming contract: {orderType}_{style}, where orderType is SAVE_THE_DATE or INVITATION and style is
 * one of CLASSIC (cream + gold, no photo), PHOTO (the couple's hero image), MINIMAL, BOTANICAL, or
 * DARK_ELEGANT. The Lob adapter keys its layout off the SAVE_THE_DATE prefix (headline) and the
 * style suffix, so keep any new member consistent with that shape.
 *
 * Issue #362 overlay suffix: a PHOTO templateKey may additionally carry a strictly-validated
 * overlay spec appended with {@link #OVERLAY_DELIMITER}, of the form
 * {@code {base}~{position}~{theme}} (e.g. {@code INVITATION_PHOTO~BOTTOM_CENTER~LIGHT}). The
 * position and theme are validated against {@link PrintTextPosition} and {@link PrintOverlayTextTheme}.
 * The suffix rides on the existing template_key column, so no schema change is needed to persist the
 * couple's 3x3 position + light/dark choice through the create -> pay -> async-Lob-batch gap. A base
 * key with no suffix stays valid and renders the default (bottom-center, light).
 */
public enum PrintTemplate {
    SAVE_THE_DATE_CLASSIC,
    SAVE_THE_DATE_PHOTO,
    SAVE_THE_DATE_MINIMAL,
    SAVE_THE_DATE_BOTANICAL,
    SAVE_THE_DATE_DARK_ELEGANT,
    INVITATION_CLASSIC,
    INVITATION_PHOTO,
    INVITATION_MINIMAL,
    INVITATION_BOTANICAL,
    INVITATION_DARK_ELEGANT;

    /** Separator between the base template key and its optional PHOTO overlay spec. Chosen because
     *  it never appears in an enum member name, so a base key can always be split off cleanly. */
    public static final char OVERLAY_DELIMITER = '~';

    private static final String PHOTO_SUFFIX = "_PHOTO";

    /**
     * True only when key is an exact, case-sensitive match for an allowed BASE template. The web
     * client always sends one of the canonical values above, so the allowlist stays strict on
     * purpose: null, blank, wrong case, or any injected value is rejected rather than coerced.
     *
     * NOTE: this validates the base key only; it does not accept an overlay suffix. Callers that
     * receive a full couple-controlled templateKey (which may carry an overlay) must use
     * {@link #isAllowedTemplateKey(String)}.
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

    /**
     * True when the full templateKey is allowed: a known base template on its own, or a PHOTO base
     * followed by a valid {@code ~position~theme} overlay spec. This is the check
     * {@code PrintOrderService} runs on the couple-supplied key.
     */
    public static boolean isAllowedTemplateKey(String key) {
        return parse(key) != null;
    }

    /**
     * The base template plus, for PHOTO cards, the resolved overlay position + theme (defaulted for
     * a bare PHOTO key). position/theme are null for a non-PHOTO base. Used by the Lob adapter to
     * branch its layout without re-parsing the raw key.
     */
    public record Parsed(String baseKey, PrintTextPosition position, PrintOverlayTextTheme theme) {
        public boolean isPhoto() {
            return baseKey.endsWith(PHOTO_SUFFIX);
        }

        public boolean isSaveTheDate() {
            return baseKey.startsWith("SAVE_THE_DATE");
        }
    }

    /**
     * Parse and validate a full couple-supplied templateKey. Returns null (rejected) unless the base
     * is on the allowlist and any overlay suffix is well-formed. Rules:
     *   - no suffix: base must be allowlisted; PHOTO bases default to BOTTOM_CENTER + LIGHT.
     *   - suffix present: only permitted on a PHOTO base, must be exactly {@code ~position~theme},
     *     and both parts must match {@link PrintTextPosition}/{@link PrintOverlayTextTheme}.
     */
    public static Parsed parse(String key) {
        if (key == null) {
            return null;
        }
        int delim = key.indexOf(OVERLAY_DELIMITER);
        String base = delim < 0 ? key : key.substring(0, delim);
        if (!isAllowed(base)) {
            return null;
        }
        boolean photo = base.endsWith(PHOTO_SUFFIX);
        if (delim < 0) {
            return new Parsed(base,
                    photo ? PrintTextPosition.DEFAULT : null,
                    photo ? PrintOverlayTextTheme.DEFAULT : null);
        }
        // An overlay suffix is only meaningful on a PHOTO card; reject it on any other base.
        if (!photo) {
            return null;
        }
        String[] mods = key.substring(delim + 1).split(String.valueOf(OVERLAY_DELIMITER), -1);
        if (mods.length != 2) {
            return null;
        }
        PrintTextPosition position = PrintTextPosition.fromKey(mods[0]);
        PrintOverlayTextTheme theme = PrintOverlayTextTheme.fromKey(mods[1]);
        if (position == null || theme == null) {
            return null;
        }
        return new Parsed(base, position, theme);
    }
}
