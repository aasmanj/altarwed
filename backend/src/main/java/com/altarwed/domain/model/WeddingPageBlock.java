package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

public record WeddingPageBlock(
        UUID id,
        UUID weddingWebsiteId,
        BlockTab tab,
        BlockType type,
        Integer sortOrder,
        // Opaque JSON payload; shape depends on `type` and is interpreted by the frontend.
        String contentJson,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public WeddingPageBlock withSortOrder(int newSortOrder) {
        return new WeddingPageBlock(id, weddingWebsiteId, tab, type, newSortOrder,
                contentJson, createdAt, LocalDateTime.now());
    }
}
