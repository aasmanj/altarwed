package com.altarwed.web.controller;

import com.altarwed.application.dto.AuthResponse;
import com.altarwed.application.dto.CoupleResponse;
import com.altarwed.application.dto.RegisterCoupleRequest;
import com.altarwed.application.service.AuthService;
import com.altarwed.application.service.CoupleService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/couples")
public class CoupleController {

    private final CoupleService coupleService;
    private final AuthService authService;

    public CoupleController(CoupleService coupleService, AuthService authService) {
        this.coupleService = coupleService;
        this.authService = authService;
    }

    /**
     * Public registration endpoint — returns auth tokens so the client is
     * immediately logged in after sign-up.
     */
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterCoupleRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CoupleResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(CoupleResponse.from(coupleService.getById(id)));
    }

    @PatchMapping("/{id}/wedding-date")
    public ResponseEntity<CoupleResponse> updateWeddingDate(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body
    ) {
        LocalDate date = LocalDate.parse(body.get("weddingDate"));
        return ResponseEntity.ok(CoupleResponse.from(coupleService.updateWeddingDate(id, date)));
    }

    @PatchMapping("/{id}/denomination")
    public ResponseEntity<CoupleResponse> updateDenomination(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body
    ) {
        UUID denominationId = UUID.fromString(body.get("denominationId"));
        return ResponseEntity.ok(CoupleResponse.from(coupleService.updateDenomination(id, denominationId)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable UUID id) {
        coupleService.deactivate(id);
        return ResponseEntity.noContent().build();
    }
}
