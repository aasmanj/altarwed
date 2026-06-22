package com.altarwed.application.dto;

import com.altarwed.domain.model.GuestRsvpStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/**
 * Per-member RSVP data submitted when the RSVP page shows multiple party members.
 * Included in SubmitRsvpRequest.partyResponses. Each attending member can carry their
 * own dietary restrictions and song request (the note-to-couple stays a single
 * party-level field on SubmitRsvpRequest, since it is one message from the responder).
 */
public record PartyMemberResponse(
        @NotNull UUID guestId,
        @NotNull GuestRsvpStatus status,
        @Size(max = 500) String dietaryRestrictions,
        @Size(max = 200) String songRequest,
        // Optional reminder interval in days; mirrors the same field on SubmitRsvpRequest.
        @Min(1) @Max(30) Integer remindInDays
) {}
