package com.altarwed.domain.model;

import java.util.List;

public record WebsiteRoster(
        List<WebsiteAdminRow> rows,
        long total,
        int page,
        int size
) {}
