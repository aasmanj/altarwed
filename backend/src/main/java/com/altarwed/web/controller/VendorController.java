package com.altarwed.web.controller;

import com.altarwed.application.dto.AuthResponse;
import com.altarwed.application.dto.InquiryResponse;
import com.altarwed.application.dto.RegisterVendorRequest;
import com.altarwed.application.dto.SubscriptionResponse;
import com.altarwed.application.dto.UpdateVendorRequest;
import com.altarwed.application.dto.VendorResponse;
import com.altarwed.application.dto.VendorStatsResponse;
import com.altarwed.application.service.MediaUploadService;
import com.altarwed.application.service.StripeService;
import com.altarwed.application.service.VendorAuthService;
import com.altarwed.application.service.VendorInquiryService;
import com.altarwed.application.service.VendorService;
import com.altarwed.domain.model.VendorSubscription;
import com.altarwed.domain.model.VendorCategory;
import com.altarwed.web.mapper.VendorMapper;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/vendors")
public class VendorController {

    private static final Logger log = LoggerFactory.getLogger(VendorController.class);

    private final VendorService vendorService;
    private final VendorAuthService vendorAuthService;
    private final VendorMapper vendorMapper;
    private final VendorInquiryService inquiryService;
    private final MediaUploadService mediaUploadService;
    private final StripeService stripeService;

    public VendorController(
            VendorService vendorService,
            VendorAuthService vendorAuthService,
            VendorMapper vendorMapper,
            VendorInquiryService inquiryService,
            MediaUploadService mediaUploadService,
            StripeService stripeService
    ) {
        this.vendorService = vendorService;
        this.vendorAuthService = vendorAuthService;
        this.vendorMapper = vendorMapper;
        this.inquiryService = inquiryService;
        this.mediaUploadService = mediaUploadService;
        this.stripeService = stripeService;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterVendorRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(vendorAuthService.register(request));
    }

    @GetMapping("/me")
    public ResponseEntity<VendorResponse> getMe(Authentication auth) {
        var vendor = vendorService.getByEmail(auth.getName());
        return ResponseEntity.ok(vendorMapper.toResponse(vendor));
    }

    @PatchMapping("/me")
    public ResponseEntity<VendorResponse> updateMe(Authentication auth, @Valid @RequestBody UpdateVendorRequest req) {
        var vendor = vendorService.getByEmail(auth.getName());
        return ResponseEntity.ok(vendorMapper.toResponse(vendorService.update(vendor.id(), req)));
    }

    @PostMapping(value = "/me/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadLogo(
            Authentication auth,
            @RequestParam("file") MultipartFile file
    ) throws IOException {
        var vendor = vendorService.getByEmail(auth.getName());
        log.info("vendor logo upload started, vendorId={}", vendor.id());
        String logoUrl = mediaUploadService.uploadVendorLogo(vendor.id(), file);
        vendorService.updateLogoUrl(vendor.id(), logoUrl);
        log.info("vendor logo upload completed, vendorId={}", vendor.id());
        return ResponseEntity.ok(Map.of("logoUrl", logoUrl));
    }

    @GetMapping("/me/inquiries")
    public ResponseEntity<List<InquiryResponse>> listInquiries(Authentication auth) {
        var vendor = vendorService.getByEmail(auth.getName());
        var inquiries = inquiryService.listForVendor(vendor.id()).stream()
                .map(i -> new InquiryResponse(i.id(), i.coupleName(), i.weddingDate(),
                        i.message(), i.isRead(), i.createdAt()))
                .toList();
        return ResponseEntity.ok(inquiries);
    }

    @PatchMapping("/me/inquiries/{id}/read")
    public ResponseEntity<Void> markRead(Authentication auth, @PathVariable UUID id) {
        var vendor = vendorService.getByEmail(auth.getName());
        log.info("inquiry mark-read requested, vendorId={}, inquiryId={}", vendor.id(), id);
        if (!inquiryService.ownsInquiry(vendor.id(), id)) {
            log.warn("inquiry ownership check failed, vendorId={}, inquiryId={}", vendor.id(), id);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        inquiryService.markRead(id);
        log.info("inquiry marked read, vendorId={}, inquiryId={}", vendor.id(), id);
        return ResponseEntity.noContent().build();
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
    public ResponseEntity<VendorResponse> getById(@PathVariable UUID id, Authentication authentication) {
        VendorResponse response = vendorMapper.toResponse(vendorService.getById(id));
        // Skip the counter when the authenticated caller is the vendor who owns this listing.
        // For unauthenticated callers and couple-authenticated callers, always count.
        boolean isSelfView = false;
        if (authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> "ROLE_VENDOR".equals(a.getAuthority()))) {
            try {
                isSelfView = vendorService.getByEmail(authentication.getName()).id().equals(id);
            } catch (Exception ignored) {
                // Vendor email not found -- count the view.
            }
        }
        if (!isSelfView) {
            try {
                vendorService.incrementViewCount(id);
            } catch (Exception ex) {
                log.warn("view count increment failed, vendorId={}", id, ex);
            }
        }
        return ResponseEntity.ok(response);
    }

    @GetMapping("/me/stats")
    public ResponseEntity<VendorStatsResponse> getMyStats(Authentication authentication) {
        var vendor = vendorService.getByEmail(authentication.getName());
        log.info("vendor stats fetched, vendorId={}", vendor.id());
        return ResponseEntity.ok(vendorService.getStats(vendor.id()));
    }

    @GetMapping("/me/subscription")
    public ResponseEntity<SubscriptionResponse> getMySubscription(Authentication authentication) {
        var vendor = vendorService.getByEmail(authentication.getName());
        VendorSubscription sub = stripeService.getSubscription(vendor.id());
        String planTier = sub != null ? sub.planTier().name() : "BASIC";
        String status = sub != null ? sub.status().name() : "NONE";
        var response = new SubscriptionResponse(
                planTier,
                status,
                sub != null ? sub.currentPeriodEnd() : null,
                stripeService.getPriceProMonthly(),
                stripeService.getPriceProAnnual()
        );
        return ResponseEntity.ok(response);
    }
}
