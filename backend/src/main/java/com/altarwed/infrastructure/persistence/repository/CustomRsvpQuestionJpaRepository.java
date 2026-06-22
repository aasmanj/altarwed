package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.CustomRsvpQuestionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CustomRsvpQuestionJpaRepository extends JpaRepository<CustomRsvpQuestionEntity, UUID> {
    List<CustomRsvpQuestionEntity> findAllByCoupleIdOrderBySortOrderAsc(UUID coupleId);
    List<CustomRsvpQuestionEntity> findAllByCoupleIdAndActiveTrueOrderBySortOrderAsc(UUID coupleId);
    boolean existsByIdAndCoupleId(UUID id, UUID coupleId);
}
