package com.altarwed.application.dto;

import com.altarwed.domain.model.VendorCategory;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record RegisterVendorRequest(

        @NotBlank(message = "Business name is required")
        @Size(max = 200)
        String businessName,

        @NotNull(message = "Category is required")
        VendorCategory category,

        @NotBlank(message = "City is required")
        @Size(max = 100)
        String city,

        @NotBlank(message = "State is required")
        @Size(max = 50)
        String state,

        @NotBlank(message = "Email is required")
        @Email(message = "Must be a valid email address")
        String email,

        @NotBlank(message = "Password is required")
        @Size(min = 8, message = "Password must be at least 8 characters")
        String password,

        boolean isChristianOwned,

        List<UUID> denominationIds
) {}
