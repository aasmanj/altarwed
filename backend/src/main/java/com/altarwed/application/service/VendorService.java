package com.altarwed.application.service;

import com.altarwed.application.dto.UpdateVendorRequest;
import com.altarwed.domain.exception.VendorNotFoundException;
import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.model.VendorCategory;
import com.altarwed.domain.port.VendorRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class VendorService {

    private static final Logger log = LoggerFactory.getLogger(VendorService.class);

    private final VendorRepository vendorRepository;

    public VendorService(VendorRepository vendorRepository) {
        this.vendorRepository = vendorRepository;
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
                existing.createdAt(),
                LocalDateTime.now()
        );
        Vendor saved = vendorRepository.save(updated);
        log.info("vendor listing updated, vendorId={}", vendorId);
        return saved;
    }

    @Transactional
    public Vendor verify(UUID vendorId) {
        log.info("vendor verify started, vendorId={}", vendorId);
        Vendor saved = vendorRepository.save(getById(vendorId).withVerified());
        log.info("vendor verified, vendorId={}", vendorId);
        return saved;
    }

    @Transactional
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
