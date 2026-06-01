package com.altarwed.web.controller;

import com.altarwed.application.service.GuestService;
import com.altarwed.web.security.CoupleAccessGuard;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/save-the-dates")
public class SaveTheDateController {

    private final GuestService guestService;
    private final CoupleAccessGuard accessGuard;

    public SaveTheDateController(GuestService guestService, CoupleAccessGuard accessGuard) {
        this.guestService = guestService;
        this.accessGuard = accessGuard;
    }

    @PostMapping("/couple/{coupleId}/send")
    public ResponseEntity<Map<String, Integer>> sendAll(
            @PathVariable UUID coupleId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        int count = guestService.sendSaveDates(coupleId);
        return ResponseEntity.ok(Map.of("sent", count));
    }
}
