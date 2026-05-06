package com.altarwed.application.dto;

import com.altarwed.domain.model.GuestRsvpStatus;
import com.altarwed.domain.model.GuestSide;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

public record UpdateGuestRequest(
        @Size(max = 200) String name,
        @Email @Size(max = 300) String email,
        @Size(max = 50) String phone,
        GuestRsvpStatus rsvpStatus,
        Boolean plusOneAllowed,
        @Size(max = 200) String plusOneName,
        @Size(max = 500) String dietaryRestrictions,
        @Size(max = 100) String mealPreference,
        @Size(max = 200) String songRequest,
        Boolean shuttleNeeded,
        Integer tableNumber,
        GuestSide side,
        String notes
) {}
