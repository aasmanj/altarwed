package com.altarwed.infrastructure.persistence.repository;

import java.time.LocalDateTime;

// Spring Data closed interface projection for the sitemap query. Because every
// accessor maps to a concrete entity property, Spring Data generates SQL that
// selects ONLY slug and updated_at, never the full WeddingWebsiteEntity row.
public interface WeddingWebsiteSitemapProjection {

    String getSlug();

    LocalDateTime getUpdatedAt();
}
