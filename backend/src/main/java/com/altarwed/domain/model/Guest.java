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
        String mealPreference,
        String songRequest,
        Boolean shuttleNeeded,
        Integer tableNumber,
        GuestSide side,
        String notes,
        String mailAddress,
        // private note left by the guest on the RSVP form; never returned by any public endpoint
        String noteForCouple,
        // number of invite emails sent for this guest; capped to prevent spamming
        Integer inviteSendCount,
        LocalDateTime inviteSentAt,
        LocalDateTime respondedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
