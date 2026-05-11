package com.altarwed.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "ceremony_sections")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CeremonySectionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "couple_id", nullable = false)
    private UUID coupleId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(name = "section_type", nullable = false, length = 50)
    private String sectionType;

    @Column(columnDefinition = "NVARCHAR(MAX)")
    private String content;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
