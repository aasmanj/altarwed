package com.altarwed.application.service;

import com.altarwed.application.dto.CreatePlanningTaskRequest;
import com.altarwed.application.dto.UpdatePlanningTaskRequest;
import com.altarwed.domain.exception.PlanningTaskNotFoundException;
import com.altarwed.domain.model.PlanningTask;
import com.altarwed.domain.model.PlanningTaskCategory;
import com.altarwed.domain.port.PlanningTaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class PlanningTaskService {

    private final PlanningTaskRepository taskRepository;

    public PlanningTaskService(PlanningTaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    @Transactional
    public List<PlanningTask> listTasks(UUID coupleId) {
        // Lazy seed: first time a couple opens their checklist, generate the default tasks.
        // This avoids needing a migration or background job to seed all existing couples.
        if (taskRepository.countByCoupleId(coupleId) == 0) {
            seedDefaultTasks(coupleId);
        }
        return taskRepository.findAllByCoupleId(coupleId);
    }

    // Custom tasks start at 1000 so they sort after the seeded defaults (which top out in the
    // low hundreds). New custom tasks then append after the current highest custom sort_order.
    private static final int CUSTOM_SORT_BASE = 1000;

    @Transactional
    public PlanningTask addTask(UUID coupleId, CreatePlanningTaskRequest req) {
        // max(sortOrder)+1, not count: after a delete the count no longer equals the next free
        // slot, which would collide a new task's sort_order with an existing one. orElse keeps
        // the first custom task at CUSTOM_SORT_BASE even when only lower-ordered seeds exist.
        int nextSort = taskRepository.findAllByCoupleId(coupleId).stream()
                .mapToInt(PlanningTask::sortOrder)
                .filter(order -> order >= CUSTOM_SORT_BASE)
                .max()
                .orElse(CUSTOM_SORT_BASE - 1) + 1;
        PlanningTask task = new PlanningTask(
                null, coupleId, req.title(), req.category(),
                req.dueMonthsBefore(), false, null,
                false, nextSort,
                null, null,
                LocalDateTime.now(), LocalDateTime.now()
        );
        return taskRepository.save(task);
    }

    @Transactional
    public PlanningTask updateTask(UUID coupleId, UUID taskId, UpdatePlanningTaskRequest req) {
        PlanningTask existing = getTask(coupleId, taskId);
        boolean completing = req.isCompleted() != null && req.isCompleted() && !existing.isCompleted();
        boolean uncompleting = req.isCompleted() != null && !req.isCompleted() && existing.isCompleted();

        PlanningTask updated = new PlanningTask(
                existing.id(), existing.coupleId(), existing.title(), existing.category(),
                existing.dueMonthsBefore(),
                req.isCompleted() != null ? req.isCompleted() : existing.isCompleted(),
                completing ? LocalDateTime.now() : (uncompleting ? null : existing.completedAt()),
                existing.isSeeded(), existing.sortOrder(),
                req.notes()    != null ? blankToNull(req.notes())    : existing.notes(),
                req.assignee() != null ? blankToNull(req.assignee()) : existing.assignee(),
                existing.createdAt(), LocalDateTime.now()
        );
        return taskRepository.save(updated);
    }

    @Transactional
    public void deleteTask(UUID coupleId, UUID taskId) {
        if (!taskRepository.existsByIdAndCoupleId(taskId, coupleId)) {
            throw new PlanningTaskNotFoundException(taskId.toString());
        }
        taskRepository.deleteById(taskId);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private PlanningTask getTask(UUID coupleId, UUID taskId) {
        PlanningTask task = taskRepository.findById(taskId)
                .orElseThrow(() -> new PlanningTaskNotFoundException(taskId.toString()));
        if (!task.coupleId().equals(coupleId)) {
            throw new PlanningTaskNotFoundException(taskId.toString());
        }
        return task;
    }

    // Empty/whitespace strings on PATCH become NULL in DB. Lets the frontend
    // clear notes/assignee by sending "" instead of needing a separate DELETE.
    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    // sortOrder values are spaced by 10 so the frontend can reorder without renumbering
    private void seedDefaultTasks(UUID coupleId) {
        record Seed(String title, PlanningTaskCategory cat, int monthsBefore, int order) {}

        List<Seed> seeds = List.of(
            // FAITH
            new Seed("Book pre-marital counseling",              PlanningTaskCategory.FAITH,     12, 10),
            new Seed("Meet with your officiant / pastor",        PlanningTaskCategory.FAITH,      9, 20),
            new Seed("Choose scripture readings for ceremony",   PlanningTaskCategory.FAITH,      6, 30),
            new Seed("Complete marriage preparation certificate", PlanningTaskCategory.FAITH,      6, 40),
            new Seed("Write personal vows",                      PlanningTaskCategory.FAITH,      3, 50),

            // LEGAL
            new Seed("Apply for marriage license",               PlanningTaskCategory.LEGAL,      1, 60),

            // CEREMONY
            new Seed("Book ceremony venue",                      PlanningTaskCategory.CEREMONY,  12, 70),
            new Seed("Choose wedding party",                     PlanningTaskCategory.CEREMONY,  10, 80),
            new Seed("Plan order of service",                    PlanningTaskCategory.CEREMONY,   3, 90),
            new Seed("Schedule rehearsal",                       PlanningTaskCategory.CEREMONY,   1, 100),

            // VENUE
            new Seed("Book reception venue",                     PlanningTaskCategory.VENUE,     12, 110),
            new Seed("Choose catering",                          PlanningTaskCategory.VENUE,      8, 120),
            new Seed("Arrange guest transportation",             PlanningTaskCategory.VENUE,      3, 130),

            // VENDORS
            new Seed("Book photographer",                        PlanningTaskCategory.VENDORS,   12, 140),
            new Seed("Book videographer",                        PlanningTaskCategory.VENDORS,   11, 150),
            new Seed("Book DJ or band",                          PlanningTaskCategory.VENDORS,    9, 160),
            new Seed("Book florist",                             PlanningTaskCategory.VENDORS,    8, 170),
            new Seed("Order wedding cake",                       PlanningTaskCategory.VENDORS,    4, 180),

            // ATTIRE
            new Seed("Choose wedding dress",                     PlanningTaskCategory.ATTIRE,    10, 190),
            new Seed("Choose bridesmaid dresses",                PlanningTaskCategory.ATTIRE,     8, 200),
            new Seed("Rent or buy groom's attire",               PlanningTaskCategory.ATTIRE,     6, 210),

            // GUESTS
            new Seed("Finalize guest list",                      PlanningTaskCategory.GUESTS,    10, 220),
            new Seed("Send save the dates",                      PlanningTaskCategory.GUESTS,     8, 230),
            new Seed("Send formal invitations",                  PlanningTaskCategory.GUESTS,     2, 240),

            // RECEPTION
            new Seed("Plan seating chart",                       PlanningTaskCategory.RECEPTION,  1, 250),

            // HONEYMOON
            new Seed("Book honeymoon",                           PlanningTaskCategory.HONEYMOON,  9, 260),
            new Seed("Prepare travel documents",                 PlanningTaskCategory.HONEYMOON,  3, 270)
        );

        LocalDateTime now = LocalDateTime.now();
        List<PlanningTask> tasks = seeds.stream().map(s -> new PlanningTask(
                null, coupleId, s.title(), s.cat(), s.monthsBefore(),
                false, null, true, s.order(),
                null, null,
                now, now
        )).toList();

        taskRepository.saveAll(tasks);
    }
}
