package com.altarwed.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "denominations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DenominationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "slug", nullable = false, unique = true, length = 100)
    private String slug;

    // Stored in a separate table: denomination_traditions
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "denomination_traditions",
            joinColumns = @JoinColumn(name = "denomination_id")
    )
    @Column(name = "tradition", nullable = false, length = 100)
    @Builder.Default
    private List<String> traditions = new ArrayList<>();
}
