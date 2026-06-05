package com.altarwed.domain.model;

/**
 * Marketing attribution captured once, at couple registration. A value object
 * (no identity of its own) grouping the five standard UTM parameters plus the
 * referrer and landing path, so the {@link Couple} aggregate carries one
 * cohesive "where did they come from" field instead of seven loose strings.
 *
 * <p>Every field is nullable: a couple who signs up by typing the URL directly
 * has no UTMs, and that is represented by {@link #empty()} (all-null), not by a
 * null AcquisitionSource. Read only by the founder /admin/metrics acquisition
 * breakdown; never shown to users.
 */
public record AcquisitionSource(
        String utmSource,
        String utmMedium,
        String utmCampaign,
        String utmTerm,
        String utmContent,
        String referrer,
        String landingPath
) {
    private static final int MAX_LEN = 255;

    private static final AcquisitionSource EMPTY =
            new AcquisitionSource(null, null, null, null, null, null, null);

    /** The "no attribution" instance: every field null. Never returns null itself. */
    public static AcquisitionSource empty() {
        return EMPTY;
    }

    /**
     * Normalising factory used at the registration boundary: trims each value,
     * treats blank as absent (null), and truncates to the column width so a
     * hostile or runaway query string can never blow past NVARCHAR(255) and
     * fail the insert. Returns {@link #empty()} when nothing survives.
     */
    public static AcquisitionSource of(
            String utmSource, String utmMedium, String utmCampaign,
            String utmTerm, String utmContent, String referrer, String landingPath) {
        return new AcquisitionSource(
                clean(utmSource), clean(utmMedium), clean(utmCampaign),
                clean(utmTerm), clean(utmContent), clean(referrer), clean(landingPath));
    }

    private static String clean(String raw) {
        if (raw == null) return null;
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) return null;
        return trimmed.length() > MAX_LEN ? trimmed.substring(0, MAX_LEN) : trimmed;
    }
}
