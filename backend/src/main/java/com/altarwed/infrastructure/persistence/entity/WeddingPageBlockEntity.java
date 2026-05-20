package com.altarwed.infrastructure.persistence.entity;

import com.altarwed.domain.model.BlockTab;
import com.altarwed.domain.model.BlockType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "wedding_page_blocks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WeddingPageBlockEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "wedding_website_id", nullable = false)
    private UUID weddingWebsiteId;

    @Enumerated(EnumType.STRING)
    @Column(name = "tab", nullable = false, length = 32)
    private BlockTab tab;

    @Enumerated(EnumType.STRING)
    @Column(name = "block_type", nullable = false, length = 32)
    private BlockType blockType;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @Column(name = "content_json", nullable = false, columnDefinition = "NVARCHAR(MAX)")
    private String contentJson;

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
