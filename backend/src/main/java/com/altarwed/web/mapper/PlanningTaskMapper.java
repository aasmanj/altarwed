package com.altarwed.web.mapper;

import com.altarwed.application.dto.PlanningTaskResponse;
import com.altarwed.domain.model.PlanningTask;
import org.springframework.stereotype.Component;

@Component
public class PlanningTaskMapper {

    public PlanningTaskResponse toResponse(PlanningTask t) {
        return new PlanningTaskResponse(
                t.id(), t.coupleId(), t.title(), t.category(),
                t.dueMonthsBefore(), t.isCompleted(), t.completedAt(),
                t.isSeeded(), t.sortOrder(),
                t.notes(), t.assignee(),
                t.createdAt(), t.updatedAt()
        );
    }
}
