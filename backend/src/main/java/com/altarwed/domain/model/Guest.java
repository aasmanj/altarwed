package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

public record Guest(
        UUID id,
        UUID coupleId,
        String name,
        String email,
        String phone,
        GuestRsvpStatus rsvpStatus,
        boolean plusOneAllowed,
        String plusOneName,
        String dietaryRestrictions,
        String songRequest,
        Integer tableNumber,
        GuestSide side,
        String notes,
        // Structured mailing address for physical mail (Lob.com postcards).
        // All four fields must be non-null to submit a postcard for this guest.
        String mailLine1,
        String mailCity,
        String mailState,
        String mailZip,
        // private note left by the guest on the RSVP form; never returned by any public endpoint
        String noteForCouple,
        // number of invite emails sent for this guest; capped to prevent spamming
        Integer inviteSendCount,
        LocalDateTime inviteSentAt,
        LocalDateTime respondedAt,
        // when set, the scheduler re-sends the RSVP invite at this time and then clears the field
        LocalDateTime remindAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        // party support: guests sharing a party_id are grouped together. null = solo guest.
        UUID partyId,
        String partyName,
        // true for the one party member who receives the invite email on behalf of the group
        Boolean partyContact
) {}
