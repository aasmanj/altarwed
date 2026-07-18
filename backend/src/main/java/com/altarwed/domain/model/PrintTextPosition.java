package com.altarwed.domain.model;

/**
 * The 3x3 grid of anchor points a couple may pick for the text block on a PHOTO print card
 * (issue #362): a vertical band (TOP / MIDDLE / BOTTOM) crossed with a horizontal alignment
 * (LEFT / CENTER / RIGHT). Persisted as part of the couple-controlled templateKey suffix (see
 * {@link PrintTemplate}), so the value is validated server-side against this closed set exactly
 * like the base template is, rather than trusted from the client. BOTTOM_CENTER is the proven
 * default that matches the original photo card (text in a bottom scrim band, clear of faces).
 */
public enum PrintTextPosition {
    TOP_LEFT,
    TOP_CENTER,
    TOP_RIGHT,
    MIDDLE_LEFT,
    MIDDLE_CENTER,
    MIDDLE_RIGHT,
    BOTTOM_LEFT,
    BOTTOM_CENTER,
    BOTTOM_RIGHT;

    /** The default placement when a photo card carries no explicit position (backward compatible). */
    public static final PrintTextPosition DEFAULT = BOTTOM_CENTER;

    /** Exact, case-sensitive match to a member, else null. Kept strict for the same reason as the
     *  {@link PrintTemplate} allowlist: the position is couple-controlled and reaches inline card CSS. */
    public static PrintTextPosition fromKey(String key) {
        if (key == null) {
            return null;
        }
        for (PrintTextPosition p : values()) {
            if (p.name().equals(key)) {
                return p;
            }
        }
        return null;
    }

    public boolean isTop() {
        return this == TOP_LEFT || this == TOP_CENTER || this == TOP_RIGHT;
    }

    public boolean isMiddle() {
        return this == MIDDLE_LEFT || this == MIDDLE_CENTER || this == MIDDLE_RIGHT;
    }

    public boolean isBottom() {
        return this == BOTTOM_LEFT || this == BOTTOM_CENTER || this == BOTTOM_RIGHT;
    }

    public boolean isLeft() {
        return this == TOP_LEFT || this == MIDDLE_LEFT || this == BOTTOM_LEFT;
    }

    public boolean isRight() {
        return this == TOP_RIGHT || this == MIDDLE_RIGHT || this == BOTTOM_RIGHT;
    }
}
