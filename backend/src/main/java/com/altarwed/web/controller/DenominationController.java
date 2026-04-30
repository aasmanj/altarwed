package com.altarwed.web.controller;

import com.altarwed.application.dto.DenominationResponse;
import com.altarwed.application.service.DenominationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/denominations")
public class DenominationController {

    private final DenominationService denominationService;

    public DenominationController(DenominationService denominationService) {
        this.denominationService = denominationService;
    }

    @GetMapping
    public ResponseEntity<List<DenominationResponse>> getAll() {
        var denominations = denominationService.getAll()
                .stream()
                .map(DenominationResponse::from)
                .toList();
        return ResponseEntity.ok(denominations);
    }

    @GetMapping("/{id}")
    public ResponseEntity<DenominationResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(DenominationResponse.from(denominationService.getById(id)));
    }

    @GetMapping("/slug/{slug}")
    public ResponseEntity<DenominationResponse> getBySlug(@PathVariable String slug) {
        return ResponseEntity.ok(DenominationResponse.from(denominationService.getBySlug(slug)));
    }
}
