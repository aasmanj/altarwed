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

    // Dedicated endpoint for seating assignment. Uses PUT (idempotent set) rather
    // than the general PATCH so null can unambiguously mean "remove from table" —
    // the general PATCH merge pattern treats null as "not provided" and can't clear
    // a field back to null.
    @PutMapping("/couple/{coupleId}/{guestId}/table")
    public ResponseEntity<GuestResponse> assignTable(
            @PathVariable UUID coupleId,
            @PathVariable UUID guestId,
            @Valid @RequestBody AssignTableRequest request
    ) {
        return ResponseEntity.ok(mapper.toResponse(guestService.assignTable(coupleId, guestId, request.tableNumber())));
    }

    @PostMapping("/couple/{coupleId}/{guestId}/invite")
    public ResponseEntity<GuestResponse> sendInvite(
            @PathVariable UUID coupleId,
            @PathVariable UUID guestId
    ) {
        return ResponseEntity.ok(mapper.toResponse(guestService.sendInvite(coupleId, guestId)));
    }

    @PostMapping("/couple/{coupleId}/bulk")
    public ResponseEntity<List<GuestResponse>> bulkAdd(
            @PathVariable UUID coupleId,
            @Valid @RequestBody com.altarwed.application.dto.BulkCreateGuestsRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(guestService.addGuestsBulk(coupleId, request.guests()).stream().map(mapper::toResponse).toList());
    }

    @PostMapping("/couple/{coupleId}/party")
    public ResponseEntity<List<GuestResponse>> createParty(
            @PathVariable UUID coupleId,
            @Valid @RequestBody com.altarwed.application.dto.CreatePartyRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(guestService.createParty(coupleId, request).stream().map(mapper::toResponse).toList());
    }

    @PostMapping("/couple/{coupleId}/invite-all")
    public ResponseEntity<Map<String, Integer>> sendAllInvites(@PathVariable UUID coupleId) {
        int count = guestService.sendAllPendingInvites(coupleId);
        return ResponseEntity.ok(Map.of("invitesSent", count));
    }

    // Public endpoints — no auth, used by the Next.js RSVP page

    /**
     * Find-your-invitation search. Guests who don't have their email handy can type
     * their name to retrieve a short-lived RSVP token. Rate-limited by Bucket4j at the
     * filter level; results are capped at 5 and names are masked to limit enumeration risk.
     */
    @GetMapping("/rsvp/find")
    public ResponseEntity<List<com.altarwed.application.dto.RsvpFindResult>> findRsvp(
            @RequestParam String slug,
            @RequestParam String name
    ) {
        if (name == null || name.trim().length() < 2) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(guestService.findGuestsByName(slug, name));
    }

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
