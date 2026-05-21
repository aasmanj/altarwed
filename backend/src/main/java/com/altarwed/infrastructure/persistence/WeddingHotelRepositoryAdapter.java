package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.WeddingHotel;
import com.altarwed.domain.port.WeddingHotelRepository;
import com.altarwed.infrastructure.persistence.entity.WeddingHotelEntity;
import com.altarwed.infrastructure.persistence.repository.WeddingHotelJpaRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
public class WeddingHotelRepositoryAdapter implements WeddingHotelRepository {

    private final WeddingHotelJpaRepository jpa;

    public WeddingHotelRepositoryAdapter(WeddingHotelJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public List<WeddingHotel> findAllByWebsiteId(UUID websiteId) {
        return jpa.findAllByWebsiteIdOrderBySortOrder(websiteId).stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<WeddingHotel> findById(UUID id) {
        return jpa.findById(id).map(this::toDomain);
    }

    @Override
    public WeddingHotel save(WeddingHotel hotel) {
        return toDomain(jpa.save(toEntity(hotel)));
    }

    @Override
    public void deleteById(UUID id) {
        jpa.deleteById(id);
    }

    @Override
    public boolean existsByIdAndWebsiteId(UUID id, UUID websiteId) {
        return jpa.existsByIdAndWebsiteId(id, websiteId);
    }

    private WeddingHotel toDomain(WeddingHotelEntity e) {
        return new WeddingHotel(
                e.getId(), e.getWebsiteId(), e.getName(), e.getAddress(),
                e.getBookingUrl(), e.getBlockRate(), e.getDistanceFromVenue(),
                e.getSortOrder(), e.getCreatedAt(), e.getUpdatedAt()
        );
    }

    private WeddingHotelEntity toEntity(WeddingHotel h) {
        return WeddingHotelEntity.builder()
                .id(h.id())
                .websiteId(h.websiteId())
                .name(h.name())
                .address(h.address())
                .bookingUrl(h.bookingUrl())
                .blockRate(h.blockRate())
                .distanceFromVenue(h.distanceFromVenue())
                .sortOrder(h.sortOrder() != null ? h.sortOrder() : 0)
                .createdAt(h.createdAt())
                .updatedAt(h.updatedAt())
                .build();
    }
}
