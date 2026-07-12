package com.altarwed.domain.model;

/**
 * The light/dark toggle for the text overlaid on a PHOTO print card (issue #362). LIGHT is the
 * proven default: light type over a dark scrim, which reads on most hero photos. DARK is for a
 * bright/low-contrast photo where light type would wash out: dark type over a light scrim.
 * Persisted as part of the couple-controlled templateKey suffix (see {@link PrintTemplate}) and
 * validated against this closed set server-side.
 */
public enum PrintOverlayTextTheme {
    LIGHT,
    DARK;

    /** The default theme when a photo card carries no explicit theme (backward compatible). */
    public static final PrintOverlayTextTheme DEFAULT = LIGHT;

    /** Exact, case-sensitive match to a member, else null. */
    public static PrintOverlayTextTheme fromKey(String key) {
        if (key == null) {
            return null;
        }
        for (PrintOverlayTextTheme t : values()) {
            if (t.name().equals(key)) {
                return t;
            }
        }
        return null;
    }
}
