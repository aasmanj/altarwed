package com.altarwed.application.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record RegisterCoupleRequest(

        @NotBlank(message = "Partner one name is required")
        @Size(max = 100)
        String partnerOneName,

        @NotBlank(message = "Partner two name is required")
        @Size(max = 100)
        String partnerTwoName,

        @NotBlank(message = "Email is required")
        @Email(message = "Must be a valid email address")
        String email,

        @NotBlank(message = "Password is required")
        @Size(min = 8, message = "Password must be at least 8 characters")
        String password,

        LocalDate weddingDate,

        UUID denominationId
) {}
