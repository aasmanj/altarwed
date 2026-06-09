package com.altarwed.application.service;

import com.altarwed.application.dto.SendInquiryRequest;
import com.altarwed.domain.exception.VendorNotFoundException;
import com.altarwed.domain.model.Inquiry;
import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.port.InquiryRepository;
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
    private final String publicSiteUrl;

    public VendorInquiryService(
            VendorService vendorService,
            AsyncEmailService emails,
            InquiryRepository inquiryRepository,
            @Value("${altarwed.nextjs.base-url}") String publicSiteUrl
    ) {
        this.vendorService = vendorService;
        this.emails = emails;
        this.inquiryRepository = inquiryRepository;
        this.publicSiteUrl = publicSiteUrl;
    }

    @Transactional
    public void send(SendInquiryRequest req) {
        Vendor vendor = vendorService.getById(req.vendorId());
        if (!vendor.isActive()) {
            log.warn("vendor inquiry rejected, vendor inactive, vendorId={}", req.vendorId());
            throw new VendorNotFoundException(req.vendorId());
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
