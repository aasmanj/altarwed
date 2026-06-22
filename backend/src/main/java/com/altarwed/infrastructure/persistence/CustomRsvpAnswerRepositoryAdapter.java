package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.CustomRsvpAnswer;
import com.altarwed.domain.port.CustomRsvpAnswerRepository;
import com.altarwed.infrastructure.persistence.entity.CustomRsvpAnswerEntity;
import com.altarwed.infrastructure.persistence.repository.CustomRsvpAnswerJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class CustomRsvpAnswerRepositoryAdapter implements CustomRsvpAnswerRepository {

    private final CustomRsvpAnswerJpaRepository jpa;

    @Override
    public List<CustomRsvpAnswer> saveAll(List<CustomRsvpAnswer> answers) {
        return jpa.saveAll(answers.stream().map(this::toEntity).toList())
                .stream().map(this::toDomain).toList();
    }

    @Override
    public List<CustomRsvpAnswer> findByGuestId(UUID guestId) {
        return jpa.findByGuestId(guestId).stream().map(this::toDomain).toList();
    }

    @Override
    public List<CustomRsvpAnswer> findByQuestionIdIn(Collection<UUID> questionIds) {
        if (questionIds == null || questionIds.isEmpty()) return List.of();
        return jpa.findByQuestionIdIn(questionIds).stream().map(this::toDomain).toList();
    }

    @Override
    public void deleteByGuestId(UUID guestId) {
        jpa.deleteByGuestId(guestId);
    }

    @Override
    public void deleteByQuestionId(UUID questionId) {
        jpa.deleteByQuestionId(questionId);
    }

    private CustomRsvpAnswer toDomain(CustomRsvpAnswerEntity e) {
        return new CustomRsvpAnswer(e.getId(), e.getQuestionId(), e.getGuestId(),
                e.getAnswerText(), e.getCreatedAt(), e.getUpdatedAt());
    }

    private CustomRsvpAnswerEntity toEntity(CustomRsvpAnswer a) {
        return CustomRsvpAnswerEntity.builder()
                .id(a.id())
                .questionId(a.questionId())
                .guestId(a.guestId())
                .answerText(a.answerText())
                .createdAt(a.createdAt())
                .updatedAt(a.updatedAt())
                .build();
    }
}
