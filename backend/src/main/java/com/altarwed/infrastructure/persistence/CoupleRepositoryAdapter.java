package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.Couple;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.infrastructure.persistence.entity.CoupleEntity;
import com.altarwed.infrastructure.persistence.repository.CoupleJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class CoupleRepositoryAdapter implements CoupleRepository {

    private final CoupleJpaRepository jpaRepository;

    @Override
    public Couple save(Couple couple) {
        CoupleEntity saved = jpaRepository.save(toEntity(couple));
        return toDomain(saved);
    }

    @Override
    public Optional<Couple> findById(UUID id) {
        return jpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    public Optional<Couple> findByEmail(String email) {
        return jpaRepository.findByEmail(email).map(this::toDomain);
    }

    @Override
    public boolean existsByEmail(String email) {
        return jpaRepository.existsByEmail(email);
    }

    @Override
    public List<Couple> findAll() {
        return jpaRepository.findAll().stream().map(this::toDomain).toList();
    }

    @Override
    public void deleteById(UUID id) {
        jpaRepository.deleteById(id);
    }

    // -------------------------------------------------------------------------
    // Mapping
    // -------------------------------------------------------------------------

    private Couple toDomain(CoupleEntity e) {
        return new Couple(
                e.getId(),
                e.getPartnerOneName(),
                e.getPartnerTwoName(),
                e.getEmail(),
                e.getPasswordHash(),
                e.getWeddingDate(),
                e.getDenominationId(),
                e.isActive(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }

    private CoupleEntity toEntity(Couple c) {
        return CoupleEntity.builder()
                .id(c.id())
                .partnerOneName(c.partnerOneName())
                .partnerTwoName(c.partnerTwoName())
                .email(c.email())
                .passwordHash(c.passwordHash())
                .weddingDate(c.weddingDate())
                .denominationId(c.denominationId())
                .isActive(c.isActive())
                .createdAt(c.createdAt())
                .updatedAt(c.updatedAt())
                .build();
    }
}
