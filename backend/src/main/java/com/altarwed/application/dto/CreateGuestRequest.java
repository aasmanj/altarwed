package com.altarwed.application.dto;

import com.altarwed.domain.model.GuestSide;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateGuestRequest(
        @NotBlank @Size(max = 200) String name,
        @Email @Size(max = 300) String email,
        @Size(max = 50) String phone,
        boolean plusOneAllowed,
        GuestSide side,
        @Size(max = 500) String dietaryRestrictions,
        String notes
) {}
