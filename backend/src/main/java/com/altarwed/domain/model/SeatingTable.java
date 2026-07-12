package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

public record SeatingTable(
        UUID id,
        UUID coupleId,
        String name,
        int capacity,
        int sortOrder,
        String shape,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    /** Reception table silhouettes the seating editor can render. */
    public static final String SHAPE_ROUND = "ROUND";
    public static final String SHAPE_RECTANGLE = "RECTANGLE";
    public static final String SHAPE_HEAD = "HEAD";

    /** Default when a couple never picks one; matches the classic round banquet table. */
    public static final String DEFAULT_SHAPE = SHAPE_ROUND;
}
