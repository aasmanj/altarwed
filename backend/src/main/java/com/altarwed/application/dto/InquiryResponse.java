package com.altarwed.application.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record InquiryResponse(
        UUID id,
        String coupleName,
        String weddingDate,
        String message,
        Boolean isRead,
        LocalDateTime createdAt
) {}
