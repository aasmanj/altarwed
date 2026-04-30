package com.altarwed.web.mapper;

import com.altarwed.application.dto.DenominationResponse;
import com.altarwed.domain.model.Denomination;
import org.springframework.stereotype.Component;

@Component
public class DenominationMapper {

    public DenominationResponse toResponse(Denomination denomination) {
        return new DenominationResponse(
                denomination.id(),
                denomination.name(),
                denomination.slug(),
                denomination.traditions()
        );
    }
}
