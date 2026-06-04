package com.altarwed.domain.port;

import com.altarwed.domain.model.MetricsSnapshot;
import com.altarwed.domain.model.WebsiteRoster;

public interface MetricsRepository {
    MetricsSnapshot snapshot();
    WebsiteRoster websiteRoster(int page, int size);
}
