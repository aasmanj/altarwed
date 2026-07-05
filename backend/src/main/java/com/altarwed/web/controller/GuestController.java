package com.altarwed.web.controller;

import com.altarwed.application.dto.*;
import com.altarwed.application.service.EmailDeliveryService;
import com.altarwed.application.service.GuestService;
import com.altarwed.domain.model.Guest;
import com.altarwed.infrastructure.security.ClientIpResolver;
import com.altarwed.web.mapper.GuestMapper;
import com.altarwed.web.security.CoupleAccessGuard;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/guests")
public class GuestController {

    private final GuestService guestService;
    private final EmailDeliveryService emailDeliveryService;
    private final GuestMapper mapper;
    private final CoupleAccessGuard accessGuard;

    public GuestController(GuestService guestService, EmailDeliveryService emailDeliveryService,
                           GuestMapper mapper, CoupleAccessGuard accessGuard) {
        this.guestService = guestService;
        this.emailDeliveryService = emailDeliveryService;
        this.mapper = mapper;
        this.accessGuard = accessGuard;
    }

    @GetMapping("/couple/{coupleId}")
    public ResponseEntity<List<GuestResponse>> list(
            @PathVariable UUID coupleId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        List<Guest> guests = guestService.listGuests(coupleId);
        Map<UUID, GuestDeliverySummary> deliveries = emailDeliveryService.deliveryStatusesByGuest(coupleId);
        Map<UUID, String> unsubscribed = guestService.unsubscribedSourcesByGuest(coupleId, guests);
        return ResponseEntity.ok(guests.stream()
                .map(g -> mapper.toResponse(g, deliveries.get(g.id()), unsubscribed.get(g.id())))
                .toList());
    }

    @PostMapping("/couple/{coupleId}")
    public ResponseEntity<GuestResponse> add(
            @PathVariable UUID coupleId,
            @Valid @RequestBody CreateGuestRequest request,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        Guest added = guestService.addGuest(coupleId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(mapper.toResponse(added, guestService.unsubscribedReason(coupleId, added)));
    }

    @PatchMapping("/couple/{coupleId}/{guestId}")
    public ResponseEntity<GuestResponse> update(
            @PathVariable UUID coupleId,
            @PathVariable UUID guestId,
            @Valid @RequestBody UpdateGuestRequest request,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        Guest updated = guestService.updateGuest(coupleId, guestId, request);
        return ResponseEntity.ok(mapper.toResponse(updated, guestService.unsubscribedReason(coupleId, updated)));
    }

    @DeleteMapping("/couple/{coupleId}/{guestId}")
    public ResponseEntity<Void> remove(
            @PathVariable UUID coupleId,
            @PathVariable UUID guestId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        guestService.removeGuest(coupleId, guestId);
        return ResponseEntity.noContent().build();
    }

    // Dedicated endpoint for seating assignment. Uses PUT (idempotent set) rather
    // than the general PATCH so null can unambiguously mean "remove from table"
    // the general PATCH merge pattern treats null as "not provided" and can't clear
    // a field back to null.
    @PutMapping("/couple/{coupleId}/{guestId}/table")
    public ResponseEntity<GuestResponse> assignTable(
            @PathVariable UUID coupleId,
            @PathVariable UUID guestId,
            @Valid @RequestBody AssignTableRequest request,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        Guest assigned = guestService.assignTable(coupleId, guestId, request.tableNumber());
        return ResponseEntity.ok(mapper.toResponse(assigned, guestService.unsubscribedReason(coupleId, assigned)));
    }

    @PostMapping("/couple/{coupleId}/{guestId}/invite")
    public ResponseEntity<GuestResponse> sendInvite(
            @PathVariable UUID coupleId,
            @PathVariable UUID guestId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        Guest invited = guestService.sendInvite(coupleId, guestId);
        return ResponseEntity.ok(mapper.toResponse(invited, guestService.unsubscribedReason(coupleId, invited)));
    }

    @PostMapping("/couple/{coupleId}/bulk")
    public ResponseEntity<List<GuestResponse>> bulkAdd(
            @PathVariable UUID coupleId,
            @Valid @RequestBody com.altarwed.application.dto.BulkCreateGuestsRequest request,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(guestService.addGuestsBulk(coupleId, request.guests()).stream().map(mapper::toResponse).toList());
    }

    @PostMapping("/couple/{coupleId}/party")
    public ResponseEntity<List<GuestResponse>> createParty(
            @PathVariable UUID coupleId,
            @Valid @RequestBody com.altarwed.application.dto.CreatePartyRequest request,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(guestService.createParty(coupleId, request).stream().map(mapper::toResponse).toList());
    }

    @PostMapping("/couple/{coupleId}/invite-all")
    public ResponseEntity<Map<String, Integer>> sendAllInvites(
            @PathVariable UUID coupleId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        int count = guestService.sendAllPendingInvites(coupleId);
        return ResponseEntity.ok(Map.of("invitesSent", count));
    }

    // Bulk RSVP invite for an explicit list of selected guest ids. Skip rules (no email,
    // already responded, cap reached, unsubscribed) are applied and reported per guest; a
    // guest id that does not belong to this couple rejects the whole request with 403.
    @PostMapping("/couple/{coupleId}/invite-bulk")
    public ResponseEntity<BulkInviteResult> sendBulkInvites(
            @PathVariable UUID coupleId,
            @Valid @RequestBody BulkInviteRequest request,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return ResponseEntity.ok(guestService.sendInvitesBulk(coupleId, request.guestIds()));
    }

    // Public endpoints, no auth, used by the Next.js RSVP page. NO ownership guard,
    // these are intentionally unauthenticated (whitelisted in SecurityConfig) and
    // scoped by slug/token, not coupleId.

    /**
     * Find-your-invitation search. Guests who don't have their email handy can type
     * their name to retrieve a short-lived RSVP token. Rate-limited by Bucket4j at the
     * filter level; results are capped at 5 and names are masked to limit enumeration risk.
     * A Turnstile captchaToken must verify before the service does any DB work (issue #89);
     * required=false because a missing token still fails verification cleanly (400) once
     * Turnstile is configured, and no-ops (200) while it is not.
     */
    @GetMapping("/rsvp/find")
    public ResponseEntity<List<com.altarwed.application.dto.RsvpFindResult>> findRsvp(
            @RequestParam String slug,
            @RequestParam String name,
            @RequestParam(required = false) String captchaToken,
            HttpServletRequest request
    ) {
        // Shares GuestService.MIN_SEARCH_QUERY_LENGTH so this 400 pre-check stays in lockstep
        // with the service guard (the service also returns empty for a too-short query).
        if (name == null || name.trim().length() < GuestService.MIN_SEARCH_QUERY_LENGTH) {
            return ResponseEntity.badRequest().build();
        }
        String remoteIp = ClientIpResolver.resolve(request);
        return ResponseEntity.ok(guestService.findGuestsByName(slug, name, captchaToken, remoteIp));
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
