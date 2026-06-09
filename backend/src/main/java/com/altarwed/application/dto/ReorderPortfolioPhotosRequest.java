package com.altarwed.application.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record ReorderPortfolioPhotosRequest(
        @NotNull @Size(max = 10) List<UUID> orderedIds
) {}
