package com.altarwed.domain.port;

import com.altarwed.domain.model.MetricsSnapshot;

public interface MetricsRepository {
    MetricsSnapshot snapshot();
}
