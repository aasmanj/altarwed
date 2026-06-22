package com.altarwed.application.dto;

import java.util.UUID;

/**
 * Lightweight view of a party member returned inside RsvpPageDataResponse.
 * Used so the RSVP page can show all members of the party, let each one indicate
 * their own attendance, and pre-fill their existing answers when re-RSVPing.
 * The current* fields are non-null only where that member already has a value.
 */
public record PartyMemberInfo(
        UUID guestId,
        String name,
        String currentRsvpStatus,
        String currentDietary,
        String currentSongRequest
) {}
