package com.altarwed.web.controller;

import com.altarwed.application.dto.AuthResponse;
import com.altarwed.application.dto.RegisterVendorRequest;
import com.altarwed.application.dto.VendorResponse;
import com.altarwed.application.service.VendorAuthService;
import com.altarwed.application.service.VendorService;
import com.altarwed.domain.model.VendorCategory;
import com.altarwed.web.mapper.VendorMapper;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/vendors")
public class VendorController {

    private final VendorService vendorService;
    private final VendorAuthService vendorAuthService;
    private final VendorMapper vendorMapper;

    public VendorController(VendorService vendorService, VendorAuthService vendorAuthService, VendorMapper vendorMapper) {
        this.vendorService = vendorService;
        this.vendorAuthService = vendorAuthService;
        this.vendorMapper = vendorMapper;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterVendorRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(vendorAuthService.register(request));
    }

    @GetMapping
    public ResponseEntity<List<VendorResponse>> search(
            @RequestParam(required = false) String city,
            @RequestParam(required = false) VendorCategory category
    ) {
        var vendors = vendorService.search(city, category)
                .stream()
                .map(vendorMapper::toResponse)
                .toList();
        return ResponseEntity.ok(vendors);
    }

    @GetMapping("/{id}")
    public ResponseEntity<VendorResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(vendorMapper.toResponse(vendorService.getById(id)));
    }
}
