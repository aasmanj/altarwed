package com.altarwed.web.controller;

import com.altarwed.application.dto.WeddingHotelRequest;
import com.altarwed.application.dto.WeddingHotelResponse;
import com.altarwed.application.service.WeddingHotelService;
import com.altarwed.domain.model.WeddingHotel;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/wedding-websites/{websiteId}/hotels")
public class WeddingHotelController {

    private final WeddingHotelService service;

    public WeddingHotelController(WeddingHotelService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<WeddingHotelResponse>> list(@PathVariable UUID websiteId) {
        return ResponseEntity.ok(service.listByWebsite(websiteId).stream().map(this::toResponse).toList());
    }

    @PostMapping
    public ResponseEntity<WeddingHotelResponse> add(
            @PathVariable UUID websiteId,
            @Valid @RequestBody WeddingHotelRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(service.addHotel(websiteId, request)));
    }

    @PatchMapping("/{hotelId}")
    public ResponseEntity<WeddingHotelResponse> update(
            @PathVariable UUID websiteId,
            @PathVariable UUID hotelId,
            @Valid @RequestBody WeddingHotelRequest request
    ) {
        return ResponseEntity.ok(toResponse(service.updateHotel(websiteId, hotelId, request)));
    }

    @DeleteMapping("/{hotelId}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID websiteId,
            @PathVariable UUID hotelId
    ) {
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
