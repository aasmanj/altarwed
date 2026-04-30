package com.altarwed.web.mapper;

import com.altarwed.application.dto.CoupleResponse;
import com.altarwed.domain.model.Couple;
import org.springframework.stereotype.Component;

@Component
public class CoupleMapper {

    public CoupleResponse toResponse(Couple couple) {
        return new CoupleResponse(
                couple.id(),
                couple.partnerOneName(),
                couple.partnerTwoName(),
                couple.email(),
                couple.weddingDate(),
                couple.denominationId(),
                couple.isActive(),
                couple.createdAt()
        );
    }
}
