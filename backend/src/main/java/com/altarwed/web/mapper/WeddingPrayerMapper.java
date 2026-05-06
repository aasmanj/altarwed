package com.altarwed.web.mapper;

import com.altarwed.application.dto.WeddingPrayerResponse;
import com.altarwed.domain.model.WeddingPrayer;
import org.springframework.stereotype.Component;

@Component
public class WeddingPrayerMapper {

    public WeddingPrayerResponse toResponse(WeddingPrayer p) {
        return new WeddingPrayerResponse(p.id(), p.guestName(), p.prayerText(), p.createdAt());
    }
}
