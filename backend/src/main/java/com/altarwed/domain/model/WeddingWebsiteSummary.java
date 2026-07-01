package com.altarwed.domain.model;

import java.time.LocalDateTime;

// Slim, read-only view of a published wedding website: only the two columns the
// sitemap needs (slug + updatedAt). Keeps the /published path from hydrating the
// full WeddingWebsite (hero text, vows, every column) just to build sitemap URLs.
public record WeddingWebsiteSummary(
        String slug,
        LocalDateTime updatedAt
) {}
