package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.CustomRsvpAnswerEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface CustomRsvpAnswerJpaRepository extends JpaRepository<CustomRsvpAnswerEntity, UUID> {
    List<CustomRsvpAnswerEntity> findByGuestId(UUID guestId);
    List<CustomRsvpAnswerEntity> findByQuestionIdIn(Collection<UUID> questionIds);

    @Modifying
    @Transactional
    void deleteByGuestId(UUID guestId);

    @Modifying
    @Transactional
    void deleteByQuestionId(UUID questionId);
}
