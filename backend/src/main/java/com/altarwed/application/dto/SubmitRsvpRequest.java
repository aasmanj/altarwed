package com.altarwed.application.dto;

import com.altarwed.domain.model.GuestRsvpStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SubmitRsvpRequest(
        @NotBlank String token,
        @NotNull GuestRsvpStatus status,
        @Size(max = 200) String plusOneName,
        @Size(max = 500) String dietaryRestrictions,
        @Size(max = 100) String mealPreference,
        @Size(max = 200) String songRequest,
        Boolean shuttleNeeded,
        // Private note from guest to the couple; surfaced only on the couple's dashboard.
        @Size(max = 1000) String noteForCouple,
        // When set, schedules a reminder invite in this many days. Frontend sends 1, 3, or 7.
        // The backend computes remindAt = now + remindInDays. Null means no reminder.
        @Min(1) @Max(30) Integer remindInDays
) {}
