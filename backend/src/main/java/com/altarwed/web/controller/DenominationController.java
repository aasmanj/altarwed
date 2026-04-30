package com.altarwed.web.controller;

import com.altarwed.application.dto.DenominationResponse;
import com.altarwed.application.service.DenominationService;
import com.altarwed.web.mapper.DenominationMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/denominations")
public class DenominationController {

    private final DenominationService denominationService;
    private final DenominationMapper denominationMapper;

    public DenominationController(DenominationService denominationService, DenominationMapper denominationMapper) {
        this.denominationService = denominationService;
        this.denominationMapper = denominationMapper;
    }

    @GetMapping
    public ResponseEntity<List<DenominationResponse>> getAll() {
        var denominations = denominationService.getAll()
                .stream()
                .map(denominationMapper::toResponse)
                .toList();
        return ResponseEntity.ok(denominations);
    }

    @GetMapping("/{id}")
    public ResponseEntity<DenominationResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(denominationMapper.toResponse(denominationService.getById(id)));
    }

    @GetMapping("/slug/{slug}")
    public ResponseEntity<DenominationResponse> getBySlug(@PathVariable String slug) {
        return ResponseEntity.ok(denominationMapper.toResponse(denominationService.getBySlug(slug)));
    }
}
