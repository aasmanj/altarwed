package com.altarwed.web.controller;

import com.altarwed.application.dto.WeddingHotelRequest;
import com.altarwed.application.dto.WeddingHotelResponse;
import com.altarwed.application.service.WeddingHotelService;
import com.altarwed.application.service.WeddingWebsiteService;
import com.altarwed.domain.exception.WeddingWebsiteNotFoundException;
import com.altarwed.domain.model.WeddingHotel;
import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.web.security.CoupleAccessGuard;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/wedding-websites/{websiteId}/hotels")
public class WeddingHotelController {

    private final WeddingHotelService service;
    private final CoupleAccessGuard accessGuard;
    private final WeddingWebsiteService websiteService;

    public WeddingHotelController(WeddingHotelService service, CoupleAccessGuard accessGuard,
                                  WeddingWebsiteService websiteService) {
        this.service = service;
        this.accessGuard = accessGuard;
        this.websiteService = websiteService;
    }

    // Public, rendered on the Next.js wedding page AND the couple dashboard list.
    // Draft gate (#536): a published site's hotels are public; a draft's hotels are
    // visible only to its owner (the dashboard attaches its JWT even though this route
    // is permitAll). Everyone else gets the same 404 a nonexistent site would.
    @GetMapping
    public ResponseEntity<List<WeddingHotelResponse>> list(
            @PathVariable UUID websiteId,
            @AuthenticationPrincipal String email
    ) {
        WeddingWebsite website = websiteService.getByIdForVisibilityCheck(websiteId);
        if (!website.isPublished() && !accessGuard.owns(website.coupleId(), email)) {
            throw new WeddingWebsiteNotFoundException(websiteId);
        }
        return ResponseEntity.ok(service.listByWebsite(websiteId).stream().map(this::toResponse).toList());
    }

    @PostMapping
    public ResponseEntity<WeddingHotelResponse> add(
            @PathVariable UUID websiteId,
            @Valid @RequestBody WeddingHotelRequest request,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwnsWebsite(websiteId, email);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(service.addHotel(websiteId, request)));
    }

    @PatchMapping("/{hotelId}")
    public ResponseEntity<WeddingHotelResponse> update(
            @PathVariable UUID websiteId,
            @PathVariable UUID hotelId,
            @Valid @RequestBody WeddingHotelRequest request,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwnsWebsite(websiteId, email);
        return ResponseEntity.ok(toResponse(service.updateHotel(websiteId, hotelId, request)));
    }

    @DeleteMapping("/{hotelId}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID websiteId,
            @PathVariable UUID hotelId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwnsWebsite(websiteId, email);
        service.deleteHotel(websiteId, hotelId);
        return ResponseEntity.noContent().build();
    }

    private WeddingHotelResponse toResponse(WeddingHotel h) {
        return new WeddingHotelResponse(
                h.id(), h.websiteId(), h.name(), h.address(),
                h.bookingUrl(), h.blockRate(), h.distanceFromVenue(),
                h.sortOrder(), h.createdAt(), h.updatedAt()
        );
    }
}
