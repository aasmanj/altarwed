package com.altarwed.web.controller;

import com.altarwed.application.dto.VendorResponse;
import com.altarwed.application.service.VendorService;
import com.altarwed.domain.model.VendorCategory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/vendors")
public class VendorController {

    private final VendorService vendorService;

    public VendorController(VendorService vendorService) {
        this.vendorService = vendorService;
    }

    @GetMapping
    public ResponseEntity<List<VendorResponse>> search(
            @RequestParam(required = false) String city,
            @RequestParam(required = false) VendorCategory category
    ) {
        var vendors = vendorService.search(city, category)
                .stream()
                .map(VendorResponse::from)
                .toList();
        return ResponseEntity.ok(vendors);
    }

    @GetMapping("/{id}")
    public ResponseEntity<VendorResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(VendorResponse.from(vendorService.getById(id)));
    }
}
