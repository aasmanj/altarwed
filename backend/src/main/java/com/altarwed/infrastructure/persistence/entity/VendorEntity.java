package com.altarwed.infrastructure.persistence.entity;

import com.altarwed.domain.model.VendorCategory;
import jakarta.persistence.*;
import org.hibernate.annotations.BatchSize;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "vendors")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VendorEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "business_name", nullable = false, length = 200)
    private String businessName;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 50)
    private VendorCategory category;

    @Column(name = "city", nullable = false, length = 100)
    private String city;

    @Column(name = "state", nullable = false, length = 50)
    private String state;

    @Column(name = "email", nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "is_christian_owned", nullable = false)
    private boolean isChristianOwned;

    // Stored in a separate join table: vendor_denomination_ids.
    // @BatchSize collapses the EAGER collection loads for a directory page into a single IN query
    // instead of one SELECT per vendor (issue #380). Without it, findDirectory returns a page of up
    // to MAX_PAGE_SIZE (50) rows and Hibernate issued 1 query for the page plus one collection
    // SELECT per row (the classic N+1 on an SEO growth surface). With a batch size that covers a
    // full page, all collections load in a single batched IN (:ids) query, so a directory render is
    // bounded at 2 queries regardless of page size. A join-fetch was rejected because Hibernate
    // cannot apply OFFSET/FETCH paging in the database alongside a fetched collection (it pages in
    // memory, "HHH000104"), which would reintroduce the full scan the paging fix (issue #135) removed.
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "vendor_denomination_ids",
            joinColumns = @JoinColumn(name = "vendor_id")
    )
    @Column(name = "denomination_id", nullable = false)
    @BatchSize(size = 50)
    @Builder.Default
    private List<UUID> denominationIds = new ArrayList<>();

    @Column(name = "is_active", nullable = false)
    private boolean isActive;

    @Column(name = "is_verified", nullable = false)
    private boolean isVerified;

    @Column(name = "price_tier", length = 3)
    private String priceTier;

    @Column(name = "bio", length = 1000)
    private String bio;

    @Column(name = "description", length = 2000)
    private String description;

    @Column(name = "website_url", length = 500)
    private String websiteUrl;

    @Column(name = "phone", length = 30)
    private String phone;

    @Column(name = "logo_url", length = 500)
    private String logoUrl;

    @Column(name = "contact_email", length = 255)
    private String contactEmail;

    @Column(name = "view_count", nullable = false)
    private int viewCount;

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
