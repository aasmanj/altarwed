package com.altarwed.web.controller;

import com.altarwed.application.dto.CreatePlanningTaskRequest;
import com.altarwed.application.dto.PlanningTaskResponse;
import com.altarwed.application.dto.UpdatePlanningTaskRequest;
import com.altarwed.application.service.PlanningTaskService;
import com.altarwed.web.mapper.PlanningTaskMapper;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/planning-tasks")
public class PlanningTaskController {

    private final PlanningTaskService service;
    private final PlanningTaskMapper mapper;

    public PlanningTaskController(PlanningTaskService service, PlanningTaskMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @GetMapping("/couple/{coupleId}")
    public ResponseEntity<List<PlanningTaskResponse>> list(@PathVariable UUID coupleId) {
        return ResponseEntity.ok(service.listTasks(coupleId).stream().map(mapper::toResponse).toList());
    }

    @PostMapping("/couple/{coupleId}")
    public ResponseEntity<PlanningTaskResponse> add(
            @PathVariable UUID coupleId,
            @Valid @RequestBody CreatePlanningTaskRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(mapper.toResponse(service.addTask(coupleId, request)));
    }

    @PatchMapping("/couple/{coupleId}/{taskId}")
    public ResponseEntity<PlanningTaskResponse> update(
            @PathVariable UUID coupleId,
            @PathVariable UUID taskId,
            @Valid @RequestBody UpdatePlanningTaskRequest request
    ) {
        return ResponseEntity.ok(mapper.toResponse(service.updateTask(coupleId, taskId, request)));
    }

    @DeleteMapping("/couple/{coupleId}/{taskId}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID coupleId,
            @PathVariable UUID taskId
    ) {
        service.deleteTask(coupleId, taskId);
        return ResponseEntity.noContent().build();
    }
}
