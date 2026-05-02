package com.altarwed.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CreateWeddingWebsiteRequest(

        @NotBlank
        @Size(min = 3, max = 100)
        @Pattern(regexp = "^[a-z0-9]+(-[a-z0-9]+)*$",
                message = "Slug must be lowercase letters, numbers, and hyphens only (e.g. jordan-and-eden-faith)")
        String slug,

        @NotBlank @Size(max = 100)
        String partnerOneName,

        @NotBlank @Size(max = 100)
        String partnerTwoName,

        LocalDate weddingDate
) {}
