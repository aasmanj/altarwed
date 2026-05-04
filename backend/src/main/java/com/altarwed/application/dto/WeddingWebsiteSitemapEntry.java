package com.altarwed.application.dto;

import java.time.LocalDateTime;

// Slim projection for the sitemap — only what Next.js needs, no PII
public record WeddingWebsiteSitemapEntry(
        String slug,
        LocalDateTime updatedAt
) {}
