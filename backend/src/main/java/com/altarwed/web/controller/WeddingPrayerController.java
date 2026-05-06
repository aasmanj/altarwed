package com.altarwed.web.controller;

import com.altarwed.application.dto.SubmitPrayerRequest;
import com.altarwed.application.dto.WeddingPrayerResponse;
import com.altarwed.application.service.WeddingPrayerService;
import com.altarwed.web.mapper.WeddingPrayerMapper;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/prayers")
public class WeddingPrayerController {

    private final WeddingPrayerService service;
    private final WeddingPrayerMapper mapper;

    public WeddingPrayerController(WeddingPrayerService service, WeddingPrayerMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    // Public — Next.js wedding page
    @GetMapping("/website/{slug}")
    public ResponseEntity<List<WeddingPrayerResponse>> list(@PathVariable String slug) {
        return ResponseEntity.ok(service.listPrayers(slug).stream().map(mapper::toResponse).toList());
    }

    // Public — Next.js wedding page
    @PostMapping("/website/{slug}")
    public ResponseEntity<WeddingPrayerResponse> submit(
            @PathVariable String slug,
            @Valid @RequestBody SubmitPrayerRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(mapper.toResponse(service.submitPrayer(slug, request)));
    }

    // Authenticated — couple moderates their prayer wall from the dashboard
    @DeleteMapping("/website/{websiteId}/{prayerId}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID websiteId,
            @PathVariable UUID prayerId
    ) {
        service.deletePrayer(websiteId, prayerId);
        return ResponseEntity.noContent().build();
    }
}
