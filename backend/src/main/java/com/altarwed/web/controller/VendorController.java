package com.altarwed.web.controller;

import com.altarwed.application.dto.AuthResponse;
import com.altarwed.application.dto.InquiryResponse;
import com.altarwed.application.dto.ListingStatusRequest;
import com.altarwed.application.dto.PromoCodeRequest;
import com.altarwed.application.dto.RegisterVendorRequest;
import com.altarwed.application.dto.ReorderPortfolioPhotosRequest;
import com.altarwed.application.dto.SubscriptionResponse;
import com.altarwed.application.dto.UpdateVendorRequest;
import com.altarwed.application.dto.VendorPortfolioPhotoResponse;
import com.altarwed.application.dto.VendorProfileResponse;
import com.altarwed.application.dto.VendorResponse;
import com.altarwed.application.dto.VendorStatsResponse;
import com.altarwed.application.service.MediaUploadService;
import com.altarwed.application.service.StripeService;
import com.altarwed.application.service.VendorAuthService;
import com.altarwed.application.service.VendorInquiryService;
import com.altarwed.application.service.VendorPortfolioPhotoService;
import com.altarwed.application.service.VendorPromoService;
import com.altarwed.application.service.VendorService;
import com.altarwed.domain.exception.VendorNotFoundException;
import com.altarwed.domain.model.SubscriptionStatus;
import com.altarwed.domain.model.VendorPortfolioPhoto;
import com.altarwed.domain.model.VendorSubscription;
import com.altarwed.domain.model.VendorCategory;
import com.altarwed.web.security.CookieService;
import com.altarwed.web.mapper.VendorMapper;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
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
    private final VendorPromoService vendorPromoService;
    private final VendorPortfolioPhotoService portfolioPhotoService;
    private final CookieService cookieService;

    public VendorController(
            VendorService vendorService,
            VendorAuthService vendorAuthService,
            VendorMapper vendorMapper,
            VendorInquiryService inquiryService,
            MediaUploadService mediaUploadService,
            StripeService stripeService,
            VendorPromoService vendorPromoService,
            VendorPortfolioPhotoService portfolioPhotoService,
            CookieService cookieService
    ) {
        this.vendorService = vendorService;
        this.vendorAuthService = vendorAuthService;
        this.vendorMapper = vendorMapper;
        this.inquiryService = inquiryService;
        this.mediaUploadService = mediaUploadService;
        this.stripeService = stripeService;
        this.vendorPromoService = vendorPromoService;
        this.portfolioPhotoService = portfolioPhotoService;
        this.cookieService = cookieService;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @Valid @RequestBody RegisterVendorRequest request,
            HttpServletResponse response) {
        AuthResponse auth = vendorAuthService.register(request);
        response.addHeader(HttpHeaders.SET_COOKIE, cookieService.createRefreshCookie(auth.refreshToken()).toString());
        return ResponseEntity.status(HttpStatus.CREATED).body(auth);
    }

    @GetMapping("/me")
    public ResponseEntity<VendorProfileResponse> getMe(Authentication auth) {
        var vendor = vendorService.getByEmail(auth.getName());
        return ResponseEntity.ok(vendorMapper.toProfileResponse(vendor));
    }

    @PatchMapping("/me")
    public ResponseEntity<VendorProfileResponse> updateMe(Authentication auth, @Valid @RequestBody UpdateVendorRequest req) {
        var vendor = vendorService.getByEmail(auth.getName());
        return ResponseEntity.ok(vendorMapper.toProfileResponse(vendorService.update(vendor.id(), req)));
    }

    // Pause/resume the vendor's own public listing (toggles isActive). Paused = hidden from the
    // directory and not accepting new inquiries; the subscription and account stay intact.
    @PatchMapping("/me/listing")
    public ResponseEntity<VendorProfileResponse> setListingActive(
            Authentication auth, @Valid @RequestBody ListingStatusRequest req) {
        var vendor = vendorService.getByEmail(auth.getName());
        return ResponseEntity.ok(
                vendorMapper.toProfileResponse(vendorService.setListingActive(vendor.id(), req.active())));
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
                .map(i -> new InquiryResponse(i.id(), i.coupleName(), i.coupleEmail(),
                        i.weddingDate(), i.message(), i.isRead(), i.createdAt()))
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
        var vendor = vendorService.getById(id);
        // A paused listing (isActive=false) is hidden from the public: the directory query already
        // excludes it, so its deep-link profile must 404 too. Otherwise the page stays indexable and
        // still renders an inquiry form that the inquiry path now rejects. 404 (not 403) leaks nothing.
        if (!vendor.isActive()) {
            throw new VendorNotFoundException(id);
        }
        VendorResponse response = vendorMapper.toResponse(vendor);
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
        return ResponseEntity.ok(toSubscriptionResponse(stripeService.getSubscription(vendor.id())));
    }

    /**
     * Redeem a comp promo code to get listed for free, without Stripe. Used on the signup
     * "Your account is ready" step and on the subscription page. An invalid code yields a 400
     * (InvalidPromoCodeException -> GlobalExceptionHandler), not a 500.
     */
    @PostMapping("/me/promo")
    public ResponseEntity<SubscriptionResponse> redeemPromo(
            Authentication authentication,
            @Valid @RequestBody PromoCodeRequest req
    ) {
        var vendor = vendorService.getByEmail(authentication.getName());
        log.info("vendor promo redemption requested, vendorId={}", vendor.id());
        VendorSubscription sub = vendorPromoService.redeem(vendor.id(), req.code());
        return ResponseEntity.ok(toSubscriptionResponse(sub));
    }

    // Single source of truth for the subscription DTO. "comped" is derived: an ACTIVE subscription
    // with no Stripe subscription id was granted by a promo, not paid for.
    private SubscriptionResponse toSubscriptionResponse(VendorSubscription sub) {
        boolean comped = sub != null
                && sub.status() == SubscriptionStatus.ACTIVE
                && sub.stripeSubscriptionId() == null;
        return new SubscriptionResponse(
                sub != null ? sub.planTier().name() : "BASIC",
                sub != null ? sub.status().name() : "NONE",
                sub != null ? sub.currentPeriodEnd() : null,
                stripeService.getPriceProMonthly(),
                stripeService.getPriceProAnnual(),
                comped
        );
    }

    @PostMapping(value = "/me/portfolio-photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<VendorPortfolioPhotoResponse> uploadPortfolioPhoto(
            Authentication auth,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "caption", required = false) String caption
    ) throws IOException {
        var vendor = vendorService.getByEmail(auth.getName());
        VendorPortfolioPhoto photo = portfolioPhotoService.addPhoto(vendor.id(), file, caption);
        return ResponseEntity.status(HttpStatus.CREATED).body(toPhotoResponse(photo));
    }

    @GetMapping("/{id}/portfolio-photos")
    public ResponseEntity<List<VendorPortfolioPhotoResponse>> listPortfolioPhotos(@PathVariable UUID id) {
        return ResponseEntity.ok(
                portfolioPhotoService.listPhotos(id).stream().map(this::toPhotoResponse).toList()
        );
    }

    @DeleteMapping("/me/portfolio-photos/{photoId}")
    public ResponseEntity<Void> deletePortfolioPhoto(Authentication auth, @PathVariable UUID photoId) {
        var vendor = vendorService.getByEmail(auth.getName());
        portfolioPhotoService.deletePhoto(vendor.id(), photoId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/me/portfolio-photos/reorder")
    public ResponseEntity<Void> reorderPortfolioPhotos(
            Authentication auth,
            @Valid @RequestBody ReorderPortfolioPhotosRequest req
    ) {
        var vendor = vendorService.getByEmail(auth.getName());
        portfolioPhotoService.reorderPhotos(vendor.id(), req.orderedIds());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/me/portfolio-photos/{photoId}/caption")
    public ResponseEntity<VendorPortfolioPhotoResponse> updatePortfolioPhotoCaption(
            Authentication auth,
            @PathVariable UUID photoId,
            @RequestParam(value = "caption", required = false) String caption
    ) {
        var vendor = vendorService.getByEmail(auth.getName());
        VendorPortfolioPhoto photo = portfolioPhotoService.updateCaption(vendor.id(), photoId, caption);
        return ResponseEntity.ok(toPhotoResponse(photo));
    }

    private VendorPortfolioPhotoResponse toPhotoResponse(VendorPortfolioPhoto p) {
        return new VendorPortfolioPhotoResponse(p.id(), p.photoUrl(), p.caption(), p.sortOrder(), p.createdAt());
    }
}
