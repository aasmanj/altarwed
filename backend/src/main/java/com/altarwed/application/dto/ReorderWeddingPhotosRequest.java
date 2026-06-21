package com.altarwed.application.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

// Full new order of an album in one request (a permutation of all photo IDs), so a
// drag-to-reorder is a single call instead of one PATCH per shifted photo. Cap is
// generous (albums are larger than vendor portfolios) but bounded to reject abuse.
public record ReorderWeddingPhotosRequest(
        @NotNull @Size(max = 500) List<UUID> orderedIds
) {}
