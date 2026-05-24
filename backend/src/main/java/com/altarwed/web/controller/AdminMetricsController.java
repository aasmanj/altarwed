package com.altarwed.web.controller;

import com.altarwed.application.service.AdminMetricsService;
import com.altarwed.domain.model.MetricsSnapshot;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/metrics")
public class AdminMetricsController {

    private final AdminMetricsService service;

    public AdminMetricsController(AdminMetricsService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<MetricsSnapshot> snapshot(Authentication auth) {
        String email = auth == null ? null : auth.getName();
        return ResponseEntity.ok(service.snapshot(email));
    }
}
