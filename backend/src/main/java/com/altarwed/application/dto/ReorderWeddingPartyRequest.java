package com.altarwed.application.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

// Full new order of a wedding party in one request (a permutation of all member IDs),
// so a drag-to-reorder is a single call. Bounded to reject abuse; weddings have far
// fewer than 100 party members.
public record ReorderWeddingPartyRequest(
        @NotNull @Size(max = 100) List<UUID> orderedIds
) {}
