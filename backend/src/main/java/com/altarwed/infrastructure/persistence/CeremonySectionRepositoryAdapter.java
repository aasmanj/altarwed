package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.CeremonySection;
import com.altarwed.domain.port.CeremonySectionRepository;
import com.altarwed.infrastructure.persistence.entity.CeremonySectionEntity;
import com.altarwed.infrastructure.persistence.repository.CeremonySectionJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class CeremonySectionRepositoryAdapter implements CeremonySectionRepository {

    private final CeremonySectionJpaRepository jpaRepository;

    @Override
    public CeremonySection save(CeremonySection section) {
        return toDomain(jpaRepository.save(toEntity(section)));
    }

    @Override
    public List<CeremonySection> findByCoupleIdOrderBySortOrder(UUID coupleId) {
        return jpaRepository.findByCoupleIdOrderBySortOrder(coupleId)
                .stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<CeremonySection> findById(UUID id) {
        return jpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    public void deleteById(UUID id) {
        jpaRepository.deleteById(id);
    }

    private CeremonySection toDomain(CeremonySectionEntity e) {
        return new CeremonySection(
                e.getId(), e.getCoupleId(), e.getTitle(), e.getSectionType(),
                e.getContent(), e.getSortOrder(), e.getCreatedAt(), e.getUpdatedAt()
        );
    }

    private CeremonySectionEntity toEntity(CeremonySection s) {
        return CeremonySectionEntity.builder()
                .id(s.id())
                .coupleId(s.coupleId())
                .title(s.title())
                .sectionType(s.sectionType())
                .content(s.content())
                .sortOrder(s.sortOrder())
                .createdAt(s.createdAt())
                .updatedAt(s.updatedAt())
                .build();
    }
}
