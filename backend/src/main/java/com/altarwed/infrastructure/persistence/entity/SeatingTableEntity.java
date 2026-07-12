package com.altarwed.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "seating_tables")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SeatingTableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "couple_id", nullable = false)
    private UUID coupleId;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "capacity", nullable = false)
    private int capacity;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    // Table silhouette (ROUND / RECTANGLE / HEAD) rendered by the seating editor.
    //
    // Persistence is deliberately deferred: the backing column needs a Flyway migration,
    // and migrations auto-apply on deploy to prod, so Jordan owns and applies it (see the
    // PR "Manual steps"). Until that migration lands this field is @Transient so Hibernate
    // ddl-auto=validate (SchemaValidationTest) stays green. The whole read/write path above
    // this line already carries shape, so turning persistence on is two mechanical edits:
    //   1. add the column via the migration in "Manual steps"
    //   2. replace the @Transient annotation below with:
    //        @Column(name = "shape", nullable = false, length = 20)
    @Transient
    private String shape;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
