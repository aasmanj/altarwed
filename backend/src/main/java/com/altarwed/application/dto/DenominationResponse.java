package com.altarwed.application.dto;

import java.util.List;
import java.util.UUID;

public record DenominationResponse(
        UUID id,
        String name,
        String slug,
        List<String> traditions
) {}
