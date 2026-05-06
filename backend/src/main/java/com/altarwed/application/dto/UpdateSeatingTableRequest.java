package com.altarwed.application.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record UpdateSeatingTableRequest(
        @Size(max = 100) String name,
        @Min(1) @Max(100) Integer capacity,
        Integer sortOrder
) {}
