package com.altarwed.application.dto;

import com.altarwed.domain.model.BlockTab;
import com.altarwed.domain.model.BlockType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateWeddingPageBlockRequest(
        @NotNull BlockTab tab,
        @NotNull BlockType type,
        @NotNull @Size(max = 50_000) String contentJson
) {}
