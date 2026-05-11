package com.altarwed.application.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record BlogPostResponse(
        UUID id,
        String slug,
        String title,
        String excerpt,
        String content,
        String author,
        LocalDateTime publishedAt,
        String seoTitle,
        String seoDesc,
        String tags,
        String coverImage,
        Boolean isPublished,
        LocalDateTime updatedAt
) {}
