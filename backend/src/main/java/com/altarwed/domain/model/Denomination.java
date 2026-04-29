package com.altarwed.domain.model;

import java.util.List;
import java.util.UUID;

public record Denomination(
        UUID id,
        String name,
        String slug,
        List<String> traditions
) {
}
