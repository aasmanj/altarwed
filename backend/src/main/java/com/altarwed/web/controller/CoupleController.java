package com.altarwed.web.controller;

import com.altarwed.application.dto.AuthResponse;
import com.altarwed.application.dto.CoupleResponse;
import com.altarwed.application.dto.RegisterCoupleRequest;
import com.altarwed.application.dto.UpdateDenominationRequest;
import com.altarwed.application.dto.UpdateWeddingDateRequest;
import com.altarwed.application.service.AuthService;
import com.altarwed.application.service.CoupleService;
import com.altarwed.web.mapper.CoupleMapper;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/couples")
public class CoupleController {

    private final CoupleService coupleService;
    private final AuthService authService;
    private final CoupleMapper coupleMapper;

    public CoupleController(CoupleService coupleService, AuthService authService, CoupleMapper coupleMapper) {
        this.coupleService = coupleService;
        this.authService = authService;
        this.coupleMapper = coupleMapper;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterCoupleRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CoupleResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(coupleMapper.toResponse(coupleService.getById(id)));
    }

    @PatchMapping("/{id}/wedding-date")
    public ResponseEntity<CoupleResponse> updateWeddingDate(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateWeddingDateRequest request
    ) {
        return ResponseEntity.ok(coupleMapper.toResponse(coupleService.updateWeddingDate(id, request.weddingDate())));
    }

    @PatchMapping("/{id}/denomination")
    public ResponseEntity<CoupleResponse> updateDenomination(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateDenominationRequest request
    ) {
        return ResponseEntity.ok(coupleMapper.toResponse(coupleService.updateDenomination(id, request.denominationId())));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable UUID id) {
        coupleService.deactivate(id);
        return ResponseEntity.noContent().build();
    }
}
