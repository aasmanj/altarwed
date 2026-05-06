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
        LocalDateTime inviteSentAt,
        LocalDateTime respondedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
