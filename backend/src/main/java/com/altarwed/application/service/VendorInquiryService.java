package com.altarwed.application.service;

import com.altarwed.application.dto.SendInquiryRequest;
import com.altarwed.domain.exception.VendorNotFoundException;
import com.altarwed.domain.model.Vendor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Orchestrates couple-to-vendor inquiry delivery.
 *
 * Phase 4-vendor reality: there is no Inquiry entity, no DB row, no thread
 * history. We just relay the message via email and rely on the vendor's
 * inbox + the couple's inbox as the system of record. Persisting inquiries
 * is deferred until we have enough vendor adoption to justify the schema.
 *
 * The hexagonal architecture rule is preserved: this service depends on
 * VendorService (application layer) and AsyncEmailService (application layer)
 * which in turn depends on the EmailPort (domain port). No infrastructure
 * imports here.
 */
@Service
public class VendorInquiryService {

    private static final Logger log = LoggerFactory.getLogger(VendorInquiryService.class);

    private final VendorService vendorService;
    private final AsyncEmailService emails;
    private final String publicSiteUrl;

    public VendorInquiryService(
            VendorService vendorService,
            AsyncEmailService emails,
            @Value("${altarwed.nextjs.base-url}") String publicSiteUrl
    ) {
        this.vendorService = vendorService;
        this.emails = emails;
        // The Next.js base URL is the canonical public site. Do NOT derive it
        // from altarwed.app.base-url via string mutation — that pattern breaks
        // for local dev (localhost:5173 != localhost:3000) and any future
        // subdomain rename.
        this.publicSiteUrl = publicSiteUrl;
    }

    public void send(SendInquiryRequest req) {
        Vendor vendor = vendorService.getById(req.vendorId());
        if (!vendor.isActive()) {
            // Treat inactive vendors as not-found from the public surface so
            // we do not leak listing state. WARN level: an expected rejection,
            // not an unexpected exception.
            log.warn("vendor inquiry rejected, vendor inactive, vendorId={}", req.vendorId());
            throw new VendorNotFoundException(req.vendorId());
        }

        String profileUrl = publicSiteUrl + "/vendors/" + vendor.id();

        // INFO at boundary entry per CLAUDE.md rule 1. Couple email is NOT
        // logged (PII per rule 8) — vendorId is the join key if support needs
        // to trace an individual inquiry.
        log.info("vendor inquiry received, vendorId={}", req.vendorId());

        // Fire-and-forget. If Resend rejects, the adapter logs WARN; the
        // couple's UI has already shown "sent" by the time the async job runs.
        // Acceptable trade-off for v1: vendors who do not reply within a week
        // are a bigger problem than a transient Resend failure.
        emails.sendVendorInquiryEmail(
                vendor.email(),
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
}
