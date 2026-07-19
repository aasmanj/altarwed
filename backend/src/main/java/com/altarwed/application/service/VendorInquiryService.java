package com.altarwed.application.service;

import com.altarwed.application.dto.SendInquiryRequest;
import com.altarwed.domain.exception.CaptchaVerificationFailedException;
import com.altarwed.domain.exception.InquiryThrottledException;
import com.altarwed.domain.exception.VendorNotFoundException;
import com.altarwed.domain.model.Inquiry;
import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.port.CaptchaVerificationPort;
import com.altarwed.domain.port.InquiryRepository;
import com.altarwed.domain.port.InquiryThrottlePort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class VendorInquiryService {

    private static final Logger log = LoggerFactory.getLogger(VendorInquiryService.class);

    private final VendorService vendorService;
    private final AsyncEmailService emails;
    private final InquiryRepository inquiryRepository;
    private final CaptchaVerificationPort captchaVerificationPort;
    private final InquiryThrottlePort inquiryThrottlePort;
    private final String publicSiteUrl;

    public VendorInquiryService(
            VendorService vendorService,
            AsyncEmailService emails,
            InquiryRepository inquiryRepository,
            CaptchaVerificationPort captchaVerificationPort,
            InquiryThrottlePort inquiryThrottlePort,
            @Value("${altarwed.nextjs.base-url}") String publicSiteUrl
    ) {
        this.vendorService = vendorService;
        this.emails = emails;
        this.inquiryRepository = inquiryRepository;
        this.captchaVerificationPort = captchaVerificationPort;
        this.inquiryThrottlePort = inquiryThrottlePort;
        this.publicSiteUrl = publicSiteUrl;
    }

    /**
     * Accepts a public vendor inquiry. Ordering is deliberate (issue #100):
     * <ol>
     *   <li>Captcha first, before any DB work, matching the RSVP find path (issue #89).
     *       Unconfigured Turnstile verifies everything (see CloudflareTurnstileAdapter),
     *       so local/dev keeps working with no keys.</li>
     *   <li>Vendor resolution + active check next, so the throttle is keyed on a
     *       verified vendor id, never attacker-invented keys.</li>
     *   <li>Per-vendor send cap last, charged only for requests that passed both
     *       gates: bot traffic that fails captcha cannot burn a vendor's inbound
     *       budget and lock real couples out.</li>
     * </ol>
     * Nothing is persisted and no email is queued unless all three gates pass.
     *
     * <p>The captcha-first ordering is also load-bearing for connection-pool health:
     * this method is @Transactional, but Hibernate only acquires the JDBC connection
     * lazily at the first DB access (vendorService.getById), so no pooled connection
     * is held across the Turnstile siteverify HTTP round-trip. Do not add DB work
     * above the captcha gate, or a flood of bot requests would pin connections while
     * waiting on Cloudflare.
     */
    @Transactional
    public void send(SendInquiryRequest req, String remoteIp) {
        if (!captchaVerificationPort.verify(req.captchaToken(), remoteIp)) {
            // vendorId only, per observability rules: never log the couple's name/email.
            log.warn("vendor inquiry rejected, reason=captcha failed, vendorId={}", req.vendorId());
            throw new CaptchaVerificationFailedException();
        }

        Vendor vendor = vendorService.getById(req.vendorId());
        if (!vendor.isActive()) {
            log.warn("vendor inquiry rejected, vendor inactive, vendorId={}", req.vendorId());
            throw new VendorNotFoundException(req.vendorId());
        }

        // Keyed on the resolved vendor id (canonical, verified) so the cap holds across
        // any number of source IPs; the per-IP RateLimitingFilter is bypassable (#41).
        if (!inquiryThrottlePort.tryAcquire(vendor.id().toString())) {
            log.warn("vendor inquiry rejected, reason=per-vendor send cap exceeded, vendorId={}", req.vendorId());
            throw new InquiryThrottledException();
        }

        log.info("vendor inquiry received, vendorId={}", req.vendorId());

        var inquiry = new Inquiry(
                null,
                vendor.id(),
                req.coupleName(),
                req.coupleEmail(),
                req.weddingDate(),
                req.message(),
                false,
                null
        );
        inquiryRepository.save(inquiry);
        log.info("vendor inquiry persisted, vendorId={}", req.vendorId());

        String profileUrl = publicSiteUrl + "/vendors/" + vendor.id();

        String notifyEmail = vendor.contactEmail() != null ? vendor.contactEmail() : vendor.email();
        emails.sendVendorInquiryEmail(
                notifyEmail,
                vendor.businessName(),
                req.coupleName(),
                req.coupleEmail(),
                req.weddingDate(),
                req.message(),
                profileUrl
        );

        emails.sendVendorInquiryConfirmation(
                req.coupleEmail(),
                req.coupleName(),
                vendor.businessName(),
                profileUrl
        );
    }

    @Transactional(readOnly = true)
    public List<Inquiry> listForVendor(UUID vendorId) {
        return inquiryRepository.findByVendorId(vendorId);
    }

    @Transactional(readOnly = true)
    public long countUnreadForVendor(UUID vendorId) {
        return inquiryRepository.countUnreadByVendorId(vendorId);
    }

    @Transactional(readOnly = true)
    public boolean ownsInquiry(UUID vendorId, UUID inquiryId) {
        return inquiryRepository.existsByIdAndVendorId(inquiryId, vendorId);
    }

    @Transactional
    public void markRead(UUID inquiryId) {
        inquiryRepository.markRead(inquiryId);
    }
}
