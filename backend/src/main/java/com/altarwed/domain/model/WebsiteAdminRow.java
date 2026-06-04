package com.altarwed.domain.model;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record WebsiteAdminRow(
        UUID coupleId,
        String email,
        String groomName,
        String brideName,
        LocalDate weddingDate,
        LocalDateTime signedUpAt,
        String slug,
        Boolean isPublished
) {}
