package com.altarwed.application.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateSeatingTableRequest(
        @NotBlank @Size(max = 100) String name,
        @Min(1) @Max(100) Integer capacity,
        // Optional; null defaults to ROUND. @Pattern only fires on a non-null value.
        @Pattern(regexp = "ROUND|RECTANGLE|HEAD") String shape
) {}
