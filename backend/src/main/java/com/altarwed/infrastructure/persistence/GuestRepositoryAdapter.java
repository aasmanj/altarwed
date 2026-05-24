package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.Guest;
import com.altarwed.domain.model.GuestRsvpStatus;
import com.altarwed.domain.port.GuestRepository;
import com.altarwed.infrastructure.persistence.entity.GuestEntity;
import com.altarwed.infrastructure.persistence.repository.GuestJpaRepository;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
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

    @Override
    public List<Guest> findDueReminders(LocalDateTime asOf) {
        return jpa.findDueReminders(asOf, GuestRsvpStatus.PENDING).stream().map(this::toDomain).toList();
    }

    @Override
    public List<Guest> findAllByPartyId(UUID partyId) {
        return jpa.findAllByPartyIdOrderByCreatedAt(partyId).stream().map(this::toDomain).toList();
    }

    @Override
    public List<Guest> findByCoupleIdAndNameContaining(UUID coupleId, String name) {
        return jpa.findAllByCoupleIdAndNameContainingIgnoreCase(coupleId, name)
                  .stream().map(this::toDomain).toList();
    }

    @Override
    public List<Guest> saveAll(List<Guest> guests) {
        return jpa.saveAll(guests.stream().map(this::toEntity).toList())
                  .stream().map(this::toDomain).toList();
    }

    private Guest toDomain(GuestEntity e) {
        return new Guest(
                e.getId(), e.getCoupleId(), e.getName(), e.getEmail(), e.getPhone(),
                e.getRsvpStatus(), e.isPlusOneAllowed(), e.getPlusOneName(),
                e.getDietaryRestrictions(), e.getMealPreference(), e.getSongRequest(),
                e.getTableNumber(), e.getSide(), e.getNotes(),
                e.getMailLine1(), e.getMailCity(), e.getMailState(), e.getMailZip(),
                e.getNoteForCouple(), e.getInviteSendCount(),
                e.getInviteSentAt(), e.getRespondedAt(), e.getRemindAt(),
                e.getCreatedAt(), e.getUpdatedAt(),
                e.getPartyId(), e.getPartyName(), e.getPartyContact()
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
                .mealPreference(g.mealPreference())
                .songRequest(g.songRequest())
                .tableNumber(g.tableNumber())
                .side(g.side())
                .notes(g.notes())
                .mailLine1(g.mailLine1())
                .mailCity(g.mailCity())
                .mailState(g.mailState() != null ? g.mailState().toUpperCase() : null)
                .mailZip(g.mailZip())
                .noteForCouple(g.noteForCouple())
                .inviteSendCount(g.inviteSendCount() != null ? g.inviteSendCount() : 0)
                .inviteSentAt(g.inviteSentAt())
                .respondedAt(g.respondedAt())
                .remindAt(g.remindAt())
                .createdAt(g.createdAt())
                .updatedAt(g.updatedAt())
                .partyId(g.partyId())
                .partyName(g.partyName())
                .partyContact(g.partyContact() != null ? g.partyContact() : false)
                .build();
    }
}
