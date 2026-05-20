package com.altarwed.application.dto;

import com.altarwed.domain.model.BlockTab;
import com.altarwed.domain.model.BlockType;

import java.time.LocalDateTime;
import java.util.UUID;

public record WeddingPageBlockResponse(
        UUID id,
        UUID weddingWebsiteId,
        BlockTab tab,
        BlockType type,
        Integer sortOrder,
        String contentJson,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
