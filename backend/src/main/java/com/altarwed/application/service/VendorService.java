package com.altarwed.application.service;

import com.altarwed.application.dto.UpdateVendorRequest;
import com.altarwed.application.dto.VendorStatsResponse;
import com.altarwed.domain.exception.VendorNotFoundException;
import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.model.VendorCategory;
import com.altarwed.domain.port.BlobStoragePort;
import com.altarwed.domain.port.InquiryRepository;
import com.altarwed.domain.port.RefreshTokenRepository;
import com.altarwed.domain.port.VendorPortfolioPhotoRepository;
import com.altarwed.domain.port.VendorRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class VendorService {

    private static final Logger log = LoggerFactory.getLogger(VendorService.class);

    private final VendorRepository vendorRepository;
    private final InquiryRepository inquiryRepository;
    private final VendorPortfolioPhotoRepository portfolioPhotoRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final BlobStoragePort blobStorage;

    public VendorService(VendorRepository vendorRepository,
                         InquiryRepository inquiryRepository,
                         VendorPortfolioPhotoRepository portfolioPhotoRepository,
                         RefreshTokenRepository refreshTokenRepository,
                         BlobStoragePort blobStorage) {
        this.vendorRepository = vendorRepository;
        this.inquiryRepository = inquiryRepository;
        this.portfolioPhotoRepository = portfolioPhotoRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.blobStorage = blobStorage;
    }

    @Transactional(readOnly = true)
    public Vendor getById(UUID id) {
        return vendorRepository.findById(id)
                .orElseThrow(() -> new VendorNotFoundException(id));
    }

    @Transactional(readOnly = true)
    public Vendor getByEmail(String email) {
        return vendorRepository.findByEmail(email)
                .orElseThrow(() -> new VendorNotFoundException(email));
    }

    @Transactional
    public Vendor update(UUID vendorId, UpdateVendorRequest req) {
        log.info("vendor listing update started, vendorId={}", vendorId);
        Vendor existing = getById(vendorId);
        Vendor updated = new Vendor(
                existing.id(),
                req.businessName()    != null ? req.businessName()    : existing.businessName(),
                req.category()        != null ? req.category()        : existing.category(),
                req.city()            != null ? req.city()            : existing.city(),
                req.state()           != null ? req.state()           : existing.state(),
                existing.email(),
                existing.passwordHash(),
                req.isChristianOwned()!= null ? req.isChristianOwned(): existing.isChristianOwned(),
                req.denominationIds() != null ? req.denominationIds() : existing.denominationIds(),
                existing.isActive(),
                existing.isVerified(),
                req.priceTier()       != null ? blankToNull(req.priceTier())       : existing.priceTier(),
                req.bio()             != null ? blankToNull(req.bio())             : existing.bio(),
                req.description()     != null ? blankToNull(req.description())     : existing.description(),
                req.websiteUrl()      != null ? blankToNull(req.websiteUrl())      : existing.websiteUrl(),
                req.phone()           != null ? blankToNull(req.phone())           : existing.phone(),
                existing.logoUrl(),
                existing.viewCount(),
                req.contactEmail()    != null ? blankToNull(req.contactEmail())    : existing.contactEmail(),
                existing.createdAt(),
                LocalDateTime.now()
        );
        Vendor saved = vendorRepository.save(updated);
        log.info("vendor listing updated, vendorId={}", vendorId);
        return saved;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Vendor verify(UUID vendorId) {
        log.info("vendor verify started, vendorId={}", vendorId);
        Vendor saved = vendorRepository.save(getById(vendorId).withVerified());
        log.info("vendor verified, vendorId={}", vendorId);
        return saved;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Vendor unverify(UUID vendorId) {
        log.info("vendor unverify started, vendorId={}", vendorId);
        Vendor saved = vendorRepository.save(getById(vendorId).withUnverified());
        log.info("vendor unverified, vendorId={}", vendorId);
        return saved;
    }

    @Transactional
    public Vendor updateLogoUrl(UUID vendorId, String logoUrl) {
        Vendor saved = vendorRepository.save(getById(vendorId).withLogoUrl(logoUrl));
        log.info("vendor logo updated, vendorId={}", vendorId);
        return saved;
    }

    @Transactional
    public void incrementViewCount(UUID vendorId) {
        vendorRepository.incrementViewCount(vendorId);
        log.debug("vendor view count incremented, vendorId={}", vendorId);
    }

    @Transactional(readOnly = true)
    public VendorStatsResponse getStats(UUID vendorId) {
        Vendor vendor = getById(vendorId);
        long totalInquiries = inquiryRepository.countByVendorId(vendorId);
        long unreadInquiries = inquiryRepository.countUnreadByVendorId(vendorId);
        return new VendorStatsResponse(vendor.viewCount() != null ? vendor.viewCount() : 0, totalInquiries, unreadInquiries);
    }

    @Transactional
    public void deleteVendor(UUID vendorId) {
        log.info("vendor hard delete started, vendorId={}", vendorId);
        Vendor vendor = getById(vendorId);

        // Capture blob URLs before the row delete. The DB cascade removes the
        // vendor_portfolio_photos rows and the vendors row (which holds logo_url),
        // but the blob objects live in Azure Storage, not the database, so without
        // explicit cleanup they would leak in storage forever.
        List<String> blobUrls = new ArrayList<>();
        if (vendor.logoUrl() != null) {
            blobUrls.add(vendor.logoUrl());
        }
        portfolioPhotoRepository.findAllByVendorId(vendorId)
                .forEach(photo -> blobUrls.add(photo.photoUrl()));

        // inquiries has no ON DELETE CASCADE, so it must be removed before the vendor row.
        inquiryRepository.deleteByVendorId(vendorId);
        // Revoke refresh tokens so a deleted vendor cannot mint fresh access tokens
        // until natural expiry. A vendor's refresh-token userId is its own id().
        refreshTokenRepository.deleteAllByUserId(vendorId);
        vendorRepository.deleteById(vendorId);

        // Best-effort blob cleanup, isolated per blob: one storage failure must not
        // abort the (already-applied) row deletes or block the remaining blobs. A
        // failure leaves a recoverable, logged orphan, which is far better than
        // refusing to delete the vendor over a transient storage error.
        for (String url : blobUrls) {
            try {
                blobStorage.delete(url);
            } catch (RuntimeException ex) {
                log.error("vendor blob orphaned, delete failed during hard delete, vendorId={}, url={}", vendorId, url, ex);
            }
        }
        log.info("vendor hard deleted, vendorId={}, blobsDeleted={}", vendorId, blobUrls.size());
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    @Transactional(readOnly = true)
    public List<Vendor> search(String city, VendorCategory category) {
        if (city != null && category != null) {
            return vendorRepository.findByCityAndCategory(city, category);
        }
        if (city != null) {
            return vendorRepository.findByCity(city);
        }
        if (category != null) {
            return vendorRepository.findByCategory(category);
        }
        return vendorRepository.findAllActive();
    }
}
