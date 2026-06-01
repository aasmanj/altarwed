package com.altarwed.web.controller;

import com.altarwed.application.dto.CreateSeatingTableRequest;
import com.altarwed.application.dto.SeatingTableResponse;
import com.altarwed.application.dto.UpdateSeatingTableRequest;
import com.altarwed.application.service.SeatingTableService;
import com.altarwed.web.security.CoupleAccessGuard;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/seating-tables")
public class SeatingTableController {

    private final SeatingTableService service;
    private final CoupleAccessGuard accessGuard;

    public SeatingTableController(SeatingTableService service, CoupleAccessGuard accessGuard) {
        this.service = service;
        this.accessGuard = accessGuard;
    }

    @GetMapping("/couple/{coupleId}")
    public ResponseEntity<List<SeatingTableResponse>> list(
            @PathVariable UUID coupleId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return ResponseEntity.ok(service.list(coupleId).stream().map(this::toResponse).toList());
    }

    @PostMapping("/couple/{coupleId}")
    public ResponseEntity<SeatingTableResponse> create(
            @PathVariable UUID coupleId,
            @Valid @RequestBody CreateSeatingTableRequest request,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(service.create(coupleId, request)));
    }

    @PatchMapping("/couple/{coupleId}/{tableId}")
    public ResponseEntity<SeatingTableResponse> update(
            @PathVariable UUID coupleId,
            @PathVariable UUID tableId,
            @Valid @RequestBody UpdateSeatingTableRequest request,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return ResponseEntity.ok(toResponse(service.update(coupleId, tableId, request)));
    }

    @DeleteMapping("/couple/{coupleId}/{tableId}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID coupleId,
            @PathVariable UUID tableId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        service.delete(coupleId, tableId);
        return ResponseEntity.noContent().build();
    }

    private SeatingTableResponse toResponse(com.altarwed.domain.model.SeatingTable t) {
        return new SeatingTableResponse(t.id(), t.coupleId(), t.name(), t.capacity(), t.sortOrder());
    }
}
