package com.altarwed.web.controller;

import com.altarwed.application.dto.CreatePlanningTaskRequest;
import com.altarwed.application.dto.PlanningTaskResponse;
import com.altarwed.application.dto.UpdatePlanningTaskRequest;
import com.altarwed.application.service.PlanningTaskService;
import com.altarwed.web.mapper.PlanningTaskMapper;
import com.altarwed.web.security.CoupleAccessGuard;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/planning-tasks")
public class PlanningTaskController {

    private final PlanningTaskService service;
    private final PlanningTaskMapper mapper;
    private final CoupleAccessGuard accessGuard;

    public PlanningTaskController(PlanningTaskService service, PlanningTaskMapper mapper, CoupleAccessGuard accessGuard) {
        this.service = service;
        this.mapper = mapper;
        this.accessGuard = accessGuard;
    }

    @GetMapping("/couple/{coupleId}")
    public ResponseEntity<List<PlanningTaskResponse>> list(
            @PathVariable UUID coupleId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return ResponseEntity.ok(service.listTasks(coupleId).stream().map(mapper::toResponse).toList());
    }

    @PostMapping("/couple/{coupleId}")
    public ResponseEntity<PlanningTaskResponse> add(
            @PathVariable UUID coupleId,
            @Valid @RequestBody CreatePlanningTaskRequest request,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(mapper.toResponse(service.addTask(coupleId, request)));
    }

    @PatchMapping("/couple/{coupleId}/{taskId}")
    public ResponseEntity<PlanningTaskResponse> update(
            @PathVariable UUID coupleId,
            @PathVariable UUID taskId,
            @Valid @RequestBody UpdatePlanningTaskRequest request,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return ResponseEntity.ok(mapper.toResponse(service.updateTask(coupleId, taskId, request)));
    }

    @DeleteMapping("/couple/{coupleId}/{taskId}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID coupleId,
            @PathVariable UUID taskId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        service.deleteTask(coupleId, taskId);
        return ResponseEntity.noContent().build();
    }
}
