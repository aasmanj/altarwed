package com.altarwed.application.dto;

import com.altarwed.domain.model.WeddingPartySide;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateWeddingPartyMemberRequest(
        @NotBlank @Size(max = 200) String name,
        @NotBlank @Size(max = 100) String role,
        @NotNull WeddingPartySide side,
        @Size(max = 1000) String bio,
        @Size(max = 500) String photoUrl,
        int sortOrder
) {}
