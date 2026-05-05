package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.Guest;
import com.altarwed.domain.port.GuestRepository;
import com.altarwed.infrastructure.persistence.entity.GuestEntity;
import com.altarwed.infrastructure.persistence.repository.GuestJpaRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
public class GuestRepositoryAdapter implements GuestRepository {

    private final GuestJpaRepository jpa;

    public GuestRepositoryAdapter(GuestJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public Guest save(Guest guest) {
        return toDomain(jpa.save(toEntity(guest)));
    }

    @Override
    public List<Guest> findAllByCoupleId(UUID coupleId) {
        return jpa.findAllByCoupleId(coupleId).stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<Guest> findById(UUID id) {
        return jpa.findById(id).map(this::toDomain);
    }

    @Override
    public void deleteById(UUID id) {
        jpa.deleteById(id);
    }

    @Override
    public boolean existsByIdAndCoupleId(UUID id, UUID coupleId) {
        return jpa.existsByIdAndCoupleId(id, coupleId);
    }

    private Guest toDomain(GuestEntity e) {
        return new Guest(
                e.getId(), e.getCoupleId(), e.getName(), e.getEmail(), e.getPhone(),
                e.getRsvpStatus(), e.isPlusOneAllowed(), e.getPlusOneName(),
                e.getDietaryRestrictions(), e.getTableNumber(), e.getSide(), e.getNotes(),
                e.getInviteSentAt(), e.getRespondedAt(), e.getCreatedAt(), e.getUpdatedAt()
        );
    }

    private GuestEntity toEntity(Guest g) {
        return GuestEntity.builder()
                .id(g.id())
                .coupleId(g.coupleId())
                .name(g.name())
                .email(g.email())
                .phone(g.phone())
                .rsvpStatus(g.rsvpStatus())
                .plusOneAllowed(g.plusOneAllowed())
                .plusOneName(g.plusOneName())
                .dietaryRestrictions(g.dietaryRestrictions())
                .tableNumber(g.tableNumber())
                .side(g.side())
                .notes(g.notes())
                .inviteSentAt(g.inviteSentAt())
                .respondedAt(g.respondedAt())
                .createdAt(g.createdAt())
                .updatedAt(g.updatedAt())
                .build();
    }
}
