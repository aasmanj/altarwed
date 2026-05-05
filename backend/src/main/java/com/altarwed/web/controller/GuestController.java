package com.altarwed.web.controller;

import com.altarwed.application.dto.*;
import com.altarwed.application.service.GuestService;
import com.altarwed.web.mapper.GuestMapper;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/guests")
public class GuestController {

    private final GuestService guestService;
    private final GuestMapper mapper;

    public GuestController(GuestService guestService, GuestMapper mapper) {
        this.guestService = guestService;
        this.mapper = mapper;
    }

    @GetMapping("/couple/{coupleId}")
    public ResponseEntity<List<GuestResponse>> list(@PathVariable UUID coupleId) {
        return ResponseEntity.ok(guestService.listGuests(coupleId).stream().map(mapper::toResponse).toList());
    }

    @PostMapping("/couple/{coupleId}")
    public ResponseEntity<GuestResponse> add(
            @PathVariable UUID coupleId,
            @Valid @RequestBody CreateGuestRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(mapper.toResponse(guestService.addGuest(coupleId, request)));
    }

    @PatchMapping("/couple/{coupleId}/{guestId}")
    public ResponseEntity<GuestResponse> update(
            @PathVariable UUID coupleId,
            @PathVariable UUID guestId,
            @Valid @RequestBody UpdateGuestRequest request
    ) {
        return ResponseEntity.ok(mapper.toResponse(guestService.updateGuest(coupleId, guestId, request)));
    }

    @DeleteMapping("/couple/{coupleId}/{guestId}")
    public ResponseEntity<Void> remove(
            @PathVariable UUID coupleId,
            @PathVariable UUID guestId
    ) {
        guestService.removeGuest(coupleId, guestId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/couple/{coupleId}/{guestId}/invite")
    public ResponseEntity<GuestResponse> sendInvite(
            @PathVariable UUID coupleId,
            @PathVariable UUID guestId
    ) {
        return ResponseEntity.ok(mapper.toResponse(guestService.sendInvite(coupleId, guestId)));
    }

    @PostMapping("/couple/{coupleId}/invite-all")
    public ResponseEntity<Map<String, Integer>> sendAllInvites(@PathVariable UUID coupleId) {
        int count = guestService.sendAllPendingInvites(coupleId);
        return ResponseEntity.ok(Map.of("invitesSent", count));
    }

    // Public endpoints — no auth, used by the Next.js RSVP page
    @GetMapping("/rsvp/{token}")
    public ResponseEntity<RsvpPageDataResponse> getRsvpPage(@PathVariable String token) {
        return ResponseEntity.ok(guestService.getRsvpPageData(token));
    }

    @PostMapping("/rsvp")
    public ResponseEntity<Void> submitRsvp(@Valid @RequestBody SubmitRsvpRequest request) {
        guestService.submitRsvp(request);
        return ResponseEntity.ok().build();
    }
}
