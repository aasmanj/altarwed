package com.altarwed.application.service;

import com.altarwed.application.dto.UpdateVendorRequest;
import com.altarwed.domain.exception.VendorNotFoundException;
import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.model.VendorCategory;
import com.altarwed.domain.port.VendorRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class VendorService {

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
                .orElseThrow(() -> new VendorNotFoundException(null));
    }

    @Transactional
    public Vendor update(UUID vendorId, UpdateVendorRequest req) {
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
                existing.createdAt(),
                LocalDateTime.now()
        );
        return vendorRepository.save(updated);
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
