package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.VendorPortfolioPhoto;
import com.altarwed.domain.port.VendorPortfolioPhotoRepository;
import com.altarwed.infrastructure.persistence.entity.VendorPortfolioPhotoEntity;
import com.altarwed.infrastructure.persistence.repository.VendorPortfolioPhotoJpaRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
public class VendorPortfolioPhotoRepositoryAdapter implements VendorPortfolioPhotoRepository {

    private final VendorPortfolioPhotoJpaRepository jpa;

    public VendorPortfolioPhotoRepositoryAdapter(VendorPortfolioPhotoJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public VendorPortfolioPhoto save(VendorPortfolioPhoto photo) {
        return toDomain(jpa.save(toEntity(photo)));
    }

    @Override
    public List<VendorPortfolioPhoto> saveAll(List<VendorPortfolioPhoto> photos) {
        return jpa.saveAll(photos.stream().map(this::toEntity).toList())
                  .stream().map(this::toDomain).toList();
    }

    @Override
    public List<VendorPortfolioPhoto> findAllByVendorId(UUID vendorId) {
        return jpa.findAllByVendorIdOrderBySortOrderAsc(vendorId)
                  .stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<VendorPortfolioPhoto> findById(UUID id) {
        return jpa.findById(id).map(this::toDomain);
    }

    @Override
    public void deleteById(UUID id) {
        jpa.deleteById(id);
    }

    @Override
    public boolean existsByIdAndVendorId(UUID id, UUID vendorId) {
        return jpa.existsByIdAndVendorId(id, vendorId);
    }

    @Override
    public int countByVendorId(UUID vendorId) {
        return jpa.countByVendorId(vendorId);
    }

    private VendorPortfolioPhoto toDomain(VendorPortfolioPhotoEntity e) {
        return new VendorPortfolioPhoto(e.getId(), e.getVendorId(), e.getPhotoUrl(), e.getCaption(), e.getSortOrder(), e.getCreatedAt());
    }

    private VendorPortfolioPhotoEntity toEntity(VendorPortfolioPhoto p) {
        return VendorPortfolioPhotoEntity.builder()
                .id(p.id())
                .vendorId(p.vendorId())
                .photoUrl(p.photoUrl())
                .caption(p.caption())
                .sortOrder(p.sortOrder())
                .createdAt(p.createdAt())
                .build();
    }
}
