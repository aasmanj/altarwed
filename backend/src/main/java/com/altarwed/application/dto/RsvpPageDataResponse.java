package com.altarwed.application.dto;

import java.util.List;

public record RsvpPageDataResponse(
        String guestName,
        String coupleNames,
        String weddingDate,
        // Raw ISO-8601 wedding date (yyyy-MM-dd) alongside the formatted display string, so
        // the RSVP confirmation screen can build a portable "add to calendar" .ics event
        // without re-parsing the localized "MMMM d, yyyy" display string. Null when unset.
        String weddingDateIso,
        // Free-form ceremony time exactly as the couple typed it (e.g. "4:00 PM"). The .ics
        // builder parses it client-side into a timed floating-local event, falling back to
        // an all-day event when it does not parse. Null when unset.
        String ceremonyTime,
        String venueName,
        // Full street address of the venue, so the .ics LOCATION field is complete rather
        // than only city/state. Null when unset.
        String venueAddress,
        String venueCity,
        String venueState,
        Boolean plusOneAllowed,
        String weddingSlug,
        // True when the couple has at least one registry URL set AND their site is published.
        // Used by the RSVP confirmation page to decide whether to show the registry link
        // or "check back soon" copy.
        Boolean hasRegistry,
        // Non-null when this guest belongs to a party. Lists all other party members
        // so the RSVP form can show per-member attendance toggles.
        List<PartyMemberInfo> partyMembers,
        String partyName,
        // Current RSVP state -- non-null when the guest has already responded (ATTENDING or
        // DECLINING). The frontend uses these to pre-populate the form and show an "update
        // your response" banner instead of presenting a blank form.
        String currentRsvpStatus,
        String currentPlusOneName,
        String currentDietary,
        String currentSongRequest,
        String currentNoteForCouple,
        // Couple-defined custom questions to render on the RSVP form (active only).
        List<CustomQuestionPublic> customQuestions
) {}
