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
        String notes,
        @Size(max = 200) String mailLine1,
        @Size(max = 100) String mailCity,
        @Size(max = 100) String mailState,
        @Size(max = 20) String mailZip,
        @Size(max = 100) String mailCountry,
        // Optional: assign guest to an existing party. Provide partyId to join an existing party.
        // Provide partyName without partyId to start a new party (a new UUID is generated server-side).
        java.util.UUID partyId,
        @Size(max = 100) String partyName,
        // True if this guest is the party contact who receives the invite email.
        Boolean partyContact
) {}
