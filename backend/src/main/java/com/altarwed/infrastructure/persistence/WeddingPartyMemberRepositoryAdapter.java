package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.WeddingPartyMember;
import com.altarwed.domain.port.WeddingPartyMemberRepository;
import com.altarwed.infrastructure.persistence.entity.WeddingPartyMemberEntity;
import com.altarwed.infrastructure.persistence.repository.WeddingPartyMemberJpaRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
public class WeddingPartyMemberRepositoryAdapter implements WeddingPartyMemberRepository {

    private final WeddingPartyMemberJpaRepository jpa;

    public WeddingPartyMemberRepositoryAdapter(WeddingPartyMemberJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public WeddingPartyMember save(WeddingPartyMember member) {
        return toDomain(jpa.save(toEntity(member)));
    }

    @Override
    public List<WeddingPartyMember> findAllByWeddingWebsiteId(UUID weddingWebsiteId) {
        return jpa.findAllByWeddingWebsiteIdOrderBySortOrderAscCreatedAtAsc(weddingWebsiteId)
                  .stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<WeddingPartyMember> findById(UUID id) {
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

    private WeddingPartyMember toDomain(WeddingPartyMemberEntity e) {
        return new WeddingPartyMember(
                e.getId(), e.getWeddingWebsiteId(), e.getName(), e.getRole(),
                e.getSide(), e.getBio(), e.getPhotoUrl(), e.getSortOrder(),
                e.getCreatedAt(), e.getUpdatedAt()
        );
    }

    private WeddingPartyMemberEntity toEntity(WeddingPartyMember m) {
        return WeddingPartyMemberEntity.builder()
                .id(m.id())
                .weddingWebsiteId(m.weddingWebsiteId())
                .name(m.name())
                .role(m.role())
                .side(m.side())
                .bio(m.bio())
                .photoUrl(m.photoUrl())
                .sortOrder(m.sortOrder())
                .createdAt(m.createdAt())
                .updatedAt(m.updatedAt())
                .build();
    }
}
