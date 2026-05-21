package com.altarwed.application.dto;

import java.util.UUID;

/**
 * Lightweight view of a party member returned inside RsvpPageDataResponse.
 * Used so the RSVP page can show all members of the party and let each one
 * indicate their own attendance.
 */
public record PartyMemberInfo(
        UUID guestId,
        String name
) {}
