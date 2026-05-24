package com.altarwed.application.service;

import com.altarwed.domain.model.MetricsSnapshot;
import com.altarwed.domain.port.MetricsRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AdminMetricsService {

    private final MetricsRepository metricsRepository;
    private final Set<String> adminEmails;

    public AdminMetricsService(
            MetricsRepository metricsRepository,
            @Value("${altarwed.admin.emails}") String adminEmailsCsv
    ) {
        this.metricsRepository = metricsRepository;
        this.adminEmails = Arrays.stream(adminEmailsCsv.split(","))
                .map(String::trim)
                .map(String::toLowerCase)
                .collect(Collectors.toUnmodifiableSet());
    }

    public MetricsSnapshot snapshot(String callerEmail) {
        if (callerEmail == null || !adminEmails.contains(callerEmail.toLowerCase())) {
            throw new AccessDeniedException("Admin access required");
        }
        return metricsRepository.snapshot();
    }
}
