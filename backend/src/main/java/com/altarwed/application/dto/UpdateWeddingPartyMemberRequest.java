package com.altarwed.application.dto;

import com.altarwed.domain.model.WeddingPartySide;
import jakarta.validation.constraints.Size;

public record UpdateWeddingPartyMemberRequest(
        @Size(max = 200) String name,
        @Size(max = 100) String role,
        WeddingPartySide side,
        @Size(max = 1000) String bio,
        @Size(max = 500) String photoUrl,
        Integer sortOrder
) {}
