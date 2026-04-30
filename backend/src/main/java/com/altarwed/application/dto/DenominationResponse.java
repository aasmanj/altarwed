package com.altarwed.application.dto;

import com.altarwed.domain.model.Denomination;

import java.util.List;
import java.util.UUID;

public record DenominationResponse(
        UUID id,
        String name,
        String slug,
        List<String> traditions
) {
    public static DenominationResponse from(Denomination denomination) {
        return new DenominationResponse(
                denomination.id(),
                denomination.name(),
                denomination.slug(),
                denomination.traditions()
        );
    }
}
