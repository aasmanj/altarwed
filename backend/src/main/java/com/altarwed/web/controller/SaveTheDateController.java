package com.altarwed.web.controller;

import com.altarwed.application.service.GuestService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/save-the-dates")
public class SaveTheDateController {

    private final GuestService guestService;

    public SaveTheDateController(GuestService guestService) {
        this.guestService = guestService;
    }

    @PostMapping("/couple/{coupleId}/send")
    public ResponseEntity<Map<String, Integer>> sendAll(@PathVariable UUID coupleId) {
        int count = guestService.sendSaveDates(coupleId);
        return ResponseEntity.ok(Map.of("sent", count));
    }
}
