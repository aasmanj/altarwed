package com.altarwed.web.controller;

import com.altarwed.application.dto.GoogleSheetSyncResponse;
import com.altarwed.application.dto.SetGoogleSheetSyncRequest;
import com.altarwed.application.service.GoogleSheetSyncService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * REST endpoints for Google Sheets guest list sync.
 *
 * PUT    /api/v1/google-sheet-sync/couple/{coupleId}         → set/update sheet URL
 * GET    /api/v1/google-sheet-sync/couple/{coupleId}         → get current sync status
 * DELETE /api/v1/google-sheet-sync/couple/{coupleId}         → remove sync config
 * POST   /api/v1/google-sheet-sync/couple/{coupleId}/trigger → manual sync now
 */
@RestController
@RequestMapping("/api/v1/google-sheet-sync")
public class GoogleSheetSyncController {

    private final GoogleSheetSyncService syncService;

    public GoogleSheetSyncController(GoogleSheetSyncService syncService) {
        this.syncService = syncService;
    }

    @PutMapping("/couple/{coupleId}")
    public ResponseEntity<GoogleSheetSyncResponse> setSync(
            @PathVariable UUID coupleId,
            @Valid @RequestBody SetGoogleSheetSyncRequest request,
            @AuthenticationPrincipal UserDetails principal
    ) {
        return ResponseEntity.ok(syncService.setSync(coupleId, request));
    }

    @GetMapping("/couple/{coupleId}")
    public ResponseEntity<GoogleSheetSyncResponse> getSync(
            @PathVariable UUID coupleId,
            @AuthenticationPrincipal UserDetails principal
    ) {
        return syncService.getSync(coupleId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/couple/{coupleId}")
    public ResponseEntity<Void> deleteSync(
            @PathVariable UUID coupleId,
            @AuthenticationPrincipal UserDetails principal
    ) {
        syncService.deleteSync(coupleId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/couple/{coupleId}/trigger")
    public ResponseEntity<GoogleSheetSyncResponse> triggerSync(
            @PathVariable UUID coupleId,
            @AuthenticationPrincipal UserDetails principal
    ) {
        return ResponseEntity.ok(syncService.triggerSync(coupleId));
    }
}
