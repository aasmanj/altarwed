package com.altarwed.application.dto;

import com.altarwed.domain.model.GuestRsvpStatus;
import com.altarwed.domain.model.GuestSide;

import java.time.LocalDateTime;
import java.util.UUID;

public record GuestResponse(
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
        LocalDateTime inviteSentAt,
        LocalDateTime respondedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
