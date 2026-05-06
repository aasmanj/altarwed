package com.altarwed.web.controller;

import com.altarwed.application.dto.BudgetSummaryResponse;
import com.altarwed.application.dto.BudgetItemResponse;
import com.altarwed.application.dto.CreateBudgetItemRequest;
import com.altarwed.application.dto.UpdateBudgetItemRequest;
import com.altarwed.application.service.BudgetItemService;
import com.altarwed.web.mapper.BudgetItemMapper;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/budget")
public class BudgetItemController {

    private final BudgetItemService service;
    private final BudgetItemMapper mapper;

    public BudgetItemController(BudgetItemService service, BudgetItemMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @GetMapping("/couple/{coupleId}")
    public ResponseEntity<BudgetSummaryResponse> getSummary(@PathVariable UUID coupleId) {
        return ResponseEntity.ok(service.getSummary(coupleId));
    }

    @PostMapping("/couple/{coupleId}")
    public ResponseEntity<BudgetItemResponse> create(
            @PathVariable UUID coupleId,
            @Valid @RequestBody CreateBudgetItemRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(mapper.toResponse(service.createItem(coupleId, request)));
    }

    @PatchMapping("/couple/{coupleId}/{itemId}")
    public ResponseEntity<BudgetItemResponse> update(
            @PathVariable UUID coupleId,
            @PathVariable UUID itemId,
            @Valid @RequestBody UpdateBudgetItemRequest request
    ) {
        return ResponseEntity.ok(mapper.toResponse(service.updateItem(coupleId, itemId, request)));
    }

    @DeleteMapping("/couple/{coupleId}/{itemId}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID coupleId,
            @PathVariable UUID itemId
    ) {
        service.deleteItem(coupleId, itemId);
        return ResponseEntity.noContent().build();
    }
}
