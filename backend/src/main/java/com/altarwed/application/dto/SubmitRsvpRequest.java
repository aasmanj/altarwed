package com.altarwed.application.dto;

import com.altarwed.domain.model.GuestRsvpStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SubmitRsvpRequest(
        @NotBlank String token,
        @NotNull GuestRsvpStatus status,
        @Size(max = 200) String plusOneName,
        @Size(max = 500) String dietaryRestrictions
) {}
