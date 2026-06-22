package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.CustomRsvpQuestion;
import com.altarwed.domain.port.CustomRsvpQuestionRepository;
import com.altarwed.infrastructure.persistence.entity.CustomRsvpQuestionEntity;
import com.altarwed.infrastructure.persistence.repository.CustomRsvpQuestionJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class CustomRsvpQuestionRepositoryAdapter implements CustomRsvpQuestionRepository {

    private final CustomRsvpQuestionJpaRepository jpa;

    @Override
    public CustomRsvpQuestion save(CustomRsvpQuestion question) {
        return toDomain(jpa.save(toEntity(question)));
    }

    @Override
    public Optional<CustomRsvpQuestion> findById(UUID id) {
        return jpa.findById(id).map(this::toDomain);
    }

    @Override
    public List<CustomRsvpQuestion> findAllByCoupleId(UUID coupleId) {
        return jpa.findAllByCoupleIdOrderBySortOrderAsc(coupleId).stream().map(this::toDomain).toList();
    }

    @Override
    public List<CustomRsvpQuestion> findActiveByCoupleId(UUID coupleId) {
        return jpa.findAllByCoupleIdAndActiveTrueOrderBySortOrderAsc(coupleId).stream().map(this::toDomain).toList();
    }

    @Override
    public void deleteById(UUID id) {
        jpa.deleteById(id);
    }

    @Override
    public boolean existsByIdAndCoupleId(UUID id, UUID coupleId) {
        return jpa.existsByIdAndCoupleId(id, coupleId);
    }

    // Options are stored newline-delimited in a single NVARCHAR(MAX) column. Blank lines
    // are dropped so trailing newlines or empty rows in the editor never become phantom
    // choices.
    private CustomRsvpQuestion toDomain(CustomRsvpQuestionEntity e) {
        List<String> options = (e.getOptions() == null || e.getOptions().isBlank())
                ? List.of()
                : Arrays.stream(e.getOptions().split("\n"))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .toList();
        return new CustomRsvpQuestion(
                e.getId(), e.getCoupleId(), e.getQuestionText(), e.getType(),
                options, e.isRequired(), e.getSortOrder(), e.isActive(),
                e.getCreatedAt(), e.getUpdatedAt());
    }

    private CustomRsvpQuestionEntity toEntity(CustomRsvpQuestion q) {
        String options = (q.options() == null || q.options().isEmpty())
                ? null
                : String.join("\n", q.options());
        return CustomRsvpQuestionEntity.builder()
                .id(q.id())
                .coupleId(q.coupleId())
                .questionText(q.questionText())
                .type(q.type())
                .options(options)
                .required(q.required())
                .sortOrder(q.sortOrder())
                .active(q.active())
                .createdAt(q.createdAt())
                .updatedAt(q.updatedAt())
                .build();
    }
}
