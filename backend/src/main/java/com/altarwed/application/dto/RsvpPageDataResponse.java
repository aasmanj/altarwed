package com.altarwed.application.dto;

public record RsvpPageDataResponse(
        String guestName,
        String coupleNames,
        String weddingDate,
        String venueName,
        String venueCity,
        String venueState,
        boolean plusOneAllowed
) {}
