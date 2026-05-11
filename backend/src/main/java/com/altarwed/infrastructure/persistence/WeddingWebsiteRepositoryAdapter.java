package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import com.altarwed.infrastructure.persistence.entity.WeddingWebsiteEntity;
import com.altarwed.infrastructure.persistence.repository.WeddingWebsiteJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class WeddingWebsiteRepositoryAdapter implements WeddingWebsiteRepository {

    private final WeddingWebsiteJpaRepository jpaRepository;

    @Override
    public WeddingWebsite save(WeddingWebsite website) {
        return toDomain(jpaRepository.save(toEntity(website)));
    }

    @Override
    public Optional<WeddingWebsite> findById(UUID id) {
        return jpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    public Optional<WeddingWebsite> findByCoupleId(UUID coupleId) {
        return jpaRepository.findByCoupleId(coupleId).map(this::toDomain);
    }

    @Override
    public Optional<WeddingWebsite> findBySlug(String slug) {
        return jpaRepository.findBySlug(slug).map(this::toDomain);
    }

    @Override
    public List<WeddingWebsite> findAllPublished() {
        return jpaRepository.findAllByIsPublishedTrueAndIsDeletedFalse()
                .stream().map(this::toDomain).toList();
    }

    @Override
    public boolean existsBySlug(String slug) {
        return jpaRepository.existsBySlug(slug);
    }

    @Override
    public boolean existsByCoupleId(UUID coupleId) {
        return jpaRepository.existsByCoupleId(coupleId);
    }

    @Override
    public List<WeddingWebsite> searchPublishedByNameAndYear(String name, Integer year) {
        LocalDate yearStart = year != null ? LocalDate.of(year, 1, 1) : null;
        LocalDate yearEnd   = year != null ? LocalDate.of(year, 12, 31) : null;
        return jpaRepository.searchPublished(name, yearStart, yearEnd)
                .stream().map(this::toDomain).toList();
    }

    // -------------------------------------------------------------------------
    // Mapping
    // -------------------------------------------------------------------------

    private WeddingWebsite toDomain(WeddingWebsiteEntity e) {
        return new WeddingWebsite(
                e.getId(), e.getCoupleId(), e.getSlug(), e.isPublished(),
                e.getPartnerOneName(), e.getPartnerTwoName(), e.getWeddingDate(),
                e.getHeroPhotoUrl(), e.getOurStory(), e.getTestimony(), e.getCovenantStatement(),
                e.getScriptureReference(), e.getScriptureText(),
                e.getVenueName(), e.getVenueAddress(), e.getVenueCity(), e.getVenueState(),
                e.getCeremonyTime(), e.getDressCode(),
                e.getHotelName(), e.getHotelUrl(), e.getHotelDetails(),
                e.getRegistryUrl1(), e.getRegistryLabel1(),
                e.getRegistryUrl2(), e.getRegistryLabel2(),
                e.getRegistryUrl3(), e.getRegistryLabel3(),
                e.getRsvpDeadline(), e.getWebsitePin(),
                e.isDeleted(), e.getDeletedAt(),
                e.getCreatedAt(), e.getUpdatedAt()
        );
    }

    private WeddingWebsiteEntity toEntity(WeddingWebsite w) {
        return WeddingWebsiteEntity.builder()
                .id(w.id())
                .coupleId(w.coupleId())
                .slug(w.slug())
                .isPublished(w.isPublished())
                .partnerOneName(w.partnerOneName())
                .partnerTwoName(w.partnerTwoName())
                .weddingDate(w.weddingDate())
                .heroPhotoUrl(w.heroPhotoUrl())
                .ourStory(w.ourStory())
                .testimony(w.testimony())
                .covenantStatement(w.covenantStatement())
                .scriptureReference(w.scriptureReference())
                .scriptureText(w.scriptureText())
                .venueName(w.venueName())
                .venueAddress(w.venueAddress())
                .venueCity(w.venueCity())
                .venueState(w.venueState())
                .ceremonyTime(w.ceremonyTime())
                .dressCode(w.dressCode())
                .hotelName(w.hotelName())
                .hotelUrl(w.hotelUrl())
                .hotelDetails(w.hotelDetails())
                .registryUrl1(w.registryUrl1())
                .registryLabel1(w.registryLabel1())
                .registryUrl2(w.registryUrl2())
                .registryLabel2(w.registryLabel2())
                .registryUrl3(w.registryUrl3())
                .registryLabel3(w.registryLabel3())
                .rsvpDeadline(w.rsvpDeadline())
                .websitePin(w.websitePin())
                .isDeleted(w.isDeleted())
                .deletedAt(w.deletedAt())
                .createdAt(w.createdAt())
                .updatedAt(w.updatedAt())
                .build();
    }
}
