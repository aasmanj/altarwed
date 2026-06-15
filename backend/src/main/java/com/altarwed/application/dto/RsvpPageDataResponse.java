package com.altarwed.application.dto;

import java.util.List;

public record RsvpPageDataResponse(
        String guestName,
        String coupleNames,
        String weddingDate,
        String venueName,
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
        String currentNoteForCouple
) {}
