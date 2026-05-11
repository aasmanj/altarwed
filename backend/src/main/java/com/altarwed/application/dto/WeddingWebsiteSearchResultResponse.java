package com.altarwed.application.dto;

import java.time.LocalDate;

public record WeddingWebsiteSearchResultResponse(
        String slug,
        String partnerOneName,
        String partnerTwoName,
        LocalDate weddingDate,
        String venueCity,
        String venueState
) {}
