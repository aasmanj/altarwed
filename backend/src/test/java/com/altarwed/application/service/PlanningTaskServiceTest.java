package com.altarwed.application.service;

import com.altarwed.application.dto.CreatePlanningTaskRequest;
import com.altarwed.domain.model.PlanningTask;
import com.altarwed.domain.model.PlanningTaskCategory;
import com.altarwed.domain.port.PlanningTaskRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PlanningTaskServiceTest {

    @Mock private PlanningTaskRepository taskRepository;

    private PlanningTaskService service() {
        return new PlanningTaskService(taskRepository);
    }

    private PlanningTask task(UUID coupleId, int sortOrder, boolean seeded) {
        LocalDateTime now = LocalDateTime.now();
        return new PlanningTask(
                UUID.randomUUID(), coupleId, "Task", PlanningTaskCategory.FAITH,
                6, false, null, seeded, sortOrder,
                null, null, now, now);
    }

    private CreatePlanningTaskRequest request() {
        return new CreatePlanningTaskRequest("Book string quartet", PlanningTaskCategory.CEREMONY, 4);
    }

    /**
     * Repro from issue #23: three custom tasks at 1000/1001/1002, delete the middle one (gap at
     * 1001), then add a new task. The old count-based derivation produced 1000 + count(2) = 1002,
     * colliding with the surviving 1002 row. The new task's sort_order must not equal any existing.
     */
    @Test
    void addTask_doesNotCollideWithExistingSortOrder_afterMiddleDelete() {
        UUID coupleId = UUID.randomUUID();
        // Surviving rows after the middle task (1001) was deleted.
        List<PlanningTask> existing = new ArrayList<>(List.of(
                task(coupleId, 1000, false),
                task(coupleId, 1002, false)
        ));
        when(taskRepository.findAllByCoupleId(coupleId)).thenReturn(existing);
        when(taskRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PlanningTask added = service().addTask(coupleId, request());

        List<Integer> existingOrders = existing.stream().map(PlanningTask::sortOrder).toList();
        assertThat(existingOrders).doesNotContain(added.sortOrder());
        assertThat(added.sortOrder()).isEqualTo(1003);
    }

    /**
     * Empty list (no rows at all): the first custom task should land at the custom base of 1000.
     */
    @Test
    void addTask_usesCustomBase_whenNoTasksExist() {
        UUID coupleId = UUID.randomUUID();
        when(taskRepository.findAllByCoupleId(coupleId)).thenReturn(List.of());
        when(taskRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PlanningTask added = service().addTask(coupleId, request());

        assertThat(added.sortOrder()).isEqualTo(1000);
    }

    /**
     * Only seeded defaults exist (orders in the low hundreds). The first custom task must still
     * start at the custom base of 1000 so it sorts above the seeded defaults, and must not derive
     * a colliding low value from the seeded rows.
     */
    @Test
    void addTask_startsAtCustomBase_whenOnlySeededTasksExist() {
        UUID coupleId = UUID.randomUUID();
        when(taskRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(
                task(coupleId, 10, true),
                task(coupleId, 140, true),
                task(coupleId, 270, true)
        ));
        when(taskRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PlanningTask added = service().addTask(coupleId, request());

        assertThat(added.sortOrder()).isEqualTo(1000);
    }

    /**
     * Mixed seeded + custom: next value is derived from the highest custom row, not the count.
     */
    @Test
    void addTask_appendsAfterHighestCustomTask_withSeededAndCustomMixed() {
        UUID coupleId = UUID.randomUUID();
        when(taskRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(
                task(coupleId, 10, true),
                task(coupleId, 270, true),
                task(coupleId, 1000, false),
                task(coupleId, 1005, false)
        ));
        when(taskRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ArgumentCaptor<PlanningTask> saved = ArgumentCaptor.forClass(PlanningTask.class);
        service().addTask(coupleId, request());

        verify(taskRepository).save(saved.capture());
        assertThat(saved.getValue().sortOrder()).isEqualTo(1006);
    }
}
