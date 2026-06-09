package com.altarwed.domain.port;

import com.altarwed.domain.model.VendorPortfolioPhoto;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VendorPortfolioPhotoRepository {
    VendorPortfolioPhoto save(VendorPortfolioPhoto photo);
    List<VendorPortfolioPhoto> saveAll(List<VendorPortfolioPhoto> photos);
    List<VendorPortfolioPhoto> findAllByVendorId(UUID vendorId);
    Optional<VendorPortfolioPhoto> findById(UUID id);
    void deleteById(UUID id);
    boolean existsByIdAndVendorId(UUID id, UUID vendorId);
    int countByVendorId(UUID vendorId);
}
