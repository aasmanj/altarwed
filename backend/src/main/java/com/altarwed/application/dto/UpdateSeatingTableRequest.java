package com.altarwed.application.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateSeatingTableRequest(
        @Size(max = 100) String name,
        @Min(1) @Max(100) Integer capacity,
        Integer sortOrder,
        // Optional; null leaves the current shape untouched. @Pattern only fires on a non-null value.
        @Pattern(regexp = "ROUND|RECTANGLE|HEAD") String shape
) {}
