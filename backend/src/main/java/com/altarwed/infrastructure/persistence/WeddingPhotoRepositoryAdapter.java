package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.WeddingPhoto;
import com.altarwed.domain.port.WeddingPhotoRepository;
import com.altarwed.infrastructure.persistence.entity.WeddingPhotoEntity;
import com.altarwed.infrastructure.persistence.repository.WeddingPhotoJpaRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
public class WeddingPhotoRepositoryAdapter implements WeddingPhotoRepository {

    private final WeddingPhotoJpaRepository jpa;

    public WeddingPhotoRepositoryAdapter(WeddingPhotoJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public WeddingPhoto save(WeddingPhoto photo) {
        return toDomain(jpa.save(toEntity(photo)));
    }

    @Override
    public List<WeddingPhoto> findAllByWeddingWebsiteId(UUID weddingWebsiteId) {
        return jpa.findAllByWeddingWebsiteIdOrderBySortOrderAsc(weddingWebsiteId)
                  .stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<WeddingPhoto> findById(UUID id) {
        return jpa.findById(id).map(this::toDomain);
    }

    @Override
    public void deleteById(UUID id) {
        jpa.deleteById(id);
    }

    @Override
    public boolean existsByIdAndWeddingWebsiteId(UUID id, UUID weddingWebsiteId) {
        return jpa.existsByIdAndWeddingWebsiteId(id, weddingWebsiteId);
    }

    private WeddingPhoto toDomain(WeddingPhotoEntity e) {
        return new WeddingPhoto(e.getId(), e.getWeddingWebsiteId(), e.getUrl(), e.getCaption(), e.getSortOrder(), e.getCreatedAt());
    }

    private WeddingPhotoEntity toEntity(WeddingPhoto p) {
        return WeddingPhotoEntity.builder()
                .id(p.id())
                .weddingWebsiteId(p.weddingWebsiteId())
                .url(p.url())
                .caption(p.caption())
                .sortOrder(p.sortOrder())
                .createdAt(p.createdAt())
                .build();
    }
}
