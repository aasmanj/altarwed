package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.WeddingPrayer;
import com.altarwed.domain.port.WeddingPrayerRepository;
import com.altarwed.infrastructure.persistence.entity.WeddingPrayerEntity;
import com.altarwed.infrastructure.persistence.repository.WeddingPrayerJpaRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
public class WeddingPrayerRepositoryAdapter implements WeddingPrayerRepository {

    private final WeddingPrayerJpaRepository jpa;

    public WeddingPrayerRepositoryAdapter(WeddingPrayerJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public WeddingPrayer save(WeddingPrayer prayer) {
        return toDomain(jpa.save(toEntity(prayer)));
    }

    @Override
    public List<WeddingPrayer> findAllByWeddingWebsiteId(UUID weddingWebsiteId) {
        return jpa.findAllByWeddingWebsiteIdOrderByCreatedAtDesc(weddingWebsiteId)
                  .stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<WeddingPrayer> findById(UUID id) {
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

    private WeddingPrayer toDomain(WeddingPrayerEntity e) {
        return new WeddingPrayer(e.getId(), e.getWeddingWebsiteId(), e.getGuestName(), e.getPrayerText(), e.getCreatedAt());
    }

    private WeddingPrayerEntity toEntity(WeddingPrayer p) {
        return WeddingPrayerEntity.builder()
                .id(p.id())
                .weddingWebsiteId(p.weddingWebsiteId())
                .guestName(p.guestName())
                .prayerText(p.prayerText())
                .createdAt(p.createdAt())
                .build();
    }
}
