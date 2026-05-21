package com.altarwed.application.dto;

import com.altarwed.domain.model.GuestRsvpStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/**
 * Per-member RSVP data submitted when the RSVP page shows multiple party members.
 * Included in SubmitRsvpRequest.partyResponses.
 */
public record PartyMemberResponse(
        @NotNull UUID guestId,
        @NotNull GuestRsvpStatus status,
        // Optional reminder interval in days; mirrors the same field on SubmitRsvpRequest.
        @Min(1) @Max(30) Integer remindInDays
) {}
