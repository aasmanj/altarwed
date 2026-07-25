package com.altarwed.application.service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Builds a standard Google Calendar "add event" template URL for a wedding reminder
 * (issue #458). Pure, side-effect-free, and unit-testable without a Spring context.
 *
 * The event is timed when the couple set a ceremony time we can parse (start = that time,
 * a two-hour default block) and all-day otherwise, which is how Google Calendar expects an
 * all-day event to be expressed (a date-only start and the next day as the exclusive end).
 * Every user-supplied field is percent-encoded so a stray "&" in a venue name or couple name
 * cannot break out of its query parameter.
 */
final class GoogleCalendarLink {

    private GoogleCalendarLink() {}

    private static final String BASE = "https://calendar.google.com/calendar/render?action=TEMPLATE";
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss");
    // Default ceremony block when we have a start time but no end: two hours.
    private static final int DEFAULT_DURATION_HOURS = 2;

    // Free-form ceremony strings we attempt, most specific first. A miss on all of them falls
    // back to an all-day event rather than guessing a wrong time.
    private static final DateTimeFormatter[] TIME_FORMATS = {
            DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("h a", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("ha", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("H:mm", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("HH:mm", Locale.ENGLISH)
    };

    /**
     * @param coupleNames  display names, e.g. "Eden & Jordan" (used in the event title)
     * @param weddingDate  required; the calendar date of the event
     * @param ceremonyTime free-form couple string ("4:00 PM"), or null for an all-day event
     * @param venueAddress street line, may be null
     * @param venueCity    may be null
     * @param venueState   may be null
     * @return a Google Calendar template URL, or null if weddingDate is null
     */
    static String build(String coupleNames, LocalDate weddingDate, String ceremonyTime,
                        String venueAddress, String venueCity, String venueState) {
        if (weddingDate == null) {
            return null;
        }
        String title = (coupleNames != null && !coupleNames.isBlank() ? coupleNames : "The Couple") + " Wedding";
        StringBuilder url = new StringBuilder(BASE)
                .append("&text=").append(encode(title))
                .append("&dates=").append(dates(weddingDate, ceremonyTime))
                .append("&details=").append(encode("We can't wait to celebrate with you."));

        String location = location(venueAddress, venueCity, venueState);
        if (location != null) {
            url.append("&location=").append(encode(location));
        }
        return url.toString();
    }

    private static String dates(LocalDate weddingDate, String ceremonyTime) {
        LocalTime start = parseTime(ceremonyTime);
        if (start == null) {
            // All-day event: Google wants the end date as the day after the start (exclusive).
            return weddingDate.format(DATE) + "/" + weddingDate.plusDays(1).format(DATE);
        }
        LocalTime end = start.plusHours(DEFAULT_DURATION_HOURS);
        return weddingDate.atTime(start).format(DATE_TIME) + "/" + weddingDate.atTime(end).format(DATE_TIME);
    }

    private static LocalTime parseTime(String ceremonyTime) {
        if (ceremonyTime == null || ceremonyTime.isBlank()) {
            return null;
        }
        String normalized = ceremonyTime.trim().toUpperCase(Locale.ENGLISH);
        for (DateTimeFormatter fmt : TIME_FORMATS) {
            try {
                return LocalTime.parse(normalized, fmt);
            } catch (Exception ignored) {
                // try the next pattern
            }
        }
        return null;
    }

    private static String location(String address, String city, String state) {
        StringBuilder sb = new StringBuilder();
        appendPart(sb, address);
        appendPart(sb, city);
        appendPart(sb, state);
        return sb.isEmpty() ? null : sb.toString();
    }

    private static void appendPart(StringBuilder sb, String part) {
        if (part != null && !part.isBlank()) {
            if (!sb.isEmpty()) {
                sb.append(", ");
            }
            sb.append(part.trim());
        }
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
