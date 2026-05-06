package com.altarwed.application.dto;

import java.util.UUID;

public record SeatingTableResponse(UUID id, UUID coupleId, String name, int capacity, int sortOrder) {}
