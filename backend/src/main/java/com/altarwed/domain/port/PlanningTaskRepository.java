package com.altarwed.domain.port;

import com.altarwed.domain.model.PlanningTask;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlanningTaskRepository {
    PlanningTask save(PlanningTask task);
    List<PlanningTask> saveAll(List<PlanningTask> tasks);
    List<PlanningTask> findAllByCoupleId(UUID coupleId);
    Optional<PlanningTask> findById(UUID id);
    void deleteById(UUID id);
    boolean existsByIdAndCoupleId(UUID id, UUID coupleId);
    long countByCoupleId(UUID coupleId);
}
