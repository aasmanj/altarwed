package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

public record Inquiry(
        UUID id,
        UUID vendorId,
        String coupleName,
        String coupleEmail,
        String weddingDate,
        String message,
        boolean isRead,
        LocalDateTime createdAt
) {}
