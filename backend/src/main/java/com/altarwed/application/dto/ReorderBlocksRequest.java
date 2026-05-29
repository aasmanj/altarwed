package com.altarwed.application.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

// New order for every block within a single tab. The list is the source of truth
// any block id present in the tab but missing from `orderedBlockIds` is left untouched
// (defensive: avoid losing blocks in the face of a stale client list).
public record ReorderBlocksRequest(
        @NotNull @NotEmpty List<UUID> orderedBlockIds
) {}
