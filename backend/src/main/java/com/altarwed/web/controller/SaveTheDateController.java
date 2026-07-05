package com.altarwed.web.controller;

import com.altarwed.application.dto.SaveTheDateSendResult;
import com.altarwed.application.service.GuestService;
import com.altarwed.web.security.CoupleAccessGuard;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
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

    // guestIds is optional -- omit or send empty list to send to all eligible guests.
    // idempotencyKey (issue #232) is a client-generated per-attempt UUID: a retry carrying the
    // same key replays the original result instead of re-emailing. Optional for backward
    // compatibility (an old client that omits it simply gets no dedup protection).
    record SendRequest(List<UUID> guestIds, String idempotencyKey) {}

    @PostMapping("/couple/{coupleId}/send")
    public ResponseEntity<SaveTheDateSendResult> sendAll(
            @PathVariable UUID coupleId,
            @RequestBody(required = false) SendRequest body,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        SaveTheDateSendResult result = guestService.sendSaveDates(
                coupleId,
                body != null ? body.guestIds() : null,
                body != null ? body.idempotencyKey() : null);
        return ResponseEntity.ok(result);
    }
}
