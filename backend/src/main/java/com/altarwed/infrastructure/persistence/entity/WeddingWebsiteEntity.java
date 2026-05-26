package com.altarwed.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "wedding_websites")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WeddingWebsiteEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "couple_id", nullable = false)
    private UUID coupleId;

    @Column(name = "slug", nullable = false, unique = true, length = 100)
    private String slug;

    @Column(name = "is_published", nullable = false)
    private boolean isPublished;

    @Column(name = "partner_one_name", nullable = false, length = 100)
    private String partnerOneName;

    @Column(name = "partner_two_name", nullable = false, length = 100)
    private String partnerTwoName;

    @Column(name = "wedding_date")
    private LocalDate weddingDate;

    @Column(name = "hero_photo_url", length = 500)
    private String heroPhotoUrl;

    @Column(name = "hero_tagline", length = 200)
    private String heroTagline;

    @Column(name = "our_story", columnDefinition = "NVARCHAR(MAX)")
    private String ourStory;

    @Column(name = "scripture_reference", length = 200)
    private String scriptureReference;

    @Column(name = "scripture_text", columnDefinition = "NVARCHAR(MAX)")
    private String scriptureText;

    @Column(name = "venue_name", length = 200)
    private String venueName;

    @Column(name = "venue_address", length = 300)
    private String venueAddress;

    @Column(name = "venue_city", length = 100)
    private String venueCity;

    @Column(name = "venue_state", length = 50)
    private String venueState;

    @Column(name = "ceremony_time", length = 50)
    private String ceremonyTime;

    @Column(name = "dress_code", length = 100)
    private String dressCode;

    @Column(name = "hotel_name", length = 200)
    private String hotelName;

    @Column(name = "hotel_url", length = 500)
    private String hotelUrl;

    @Column(name = "hotel_details", columnDefinition = "NVARCHAR(MAX)")
    private String hotelDetails;

    @Column(name = "registry_url_1", length = 500)
    private String registryUrl1;

    @Column(name = "registry_label_1", length = 100)
    private String registryLabel1;

    @Column(name = "registry_url_2", length = 500)
    private String registryUrl2;

    @Column(name = "registry_label_2", length = 100)
    private String registryLabel2;

    @Column(name = "registry_url_3", length = 500)
    private String registryUrl3;

    @Column(name = "registry_label_3", length = 100)
    private String registryLabel3;

    @Column(name = "rsvp_deadline")
    private LocalDate rsvpDeadline;

    @Column(name = "partner_one_vows", columnDefinition = "NVARCHAR(MAX)")
    private String partnerOneVows;

    @Column(name = "partner_two_vows", columnDefinition = "NVARCHAR(MAX)")
    private String partnerTwoVows;

    @Column(name = "goal_budget", precision = 10, scale = 2)
    private BigDecimal goalBudget;

    // V34: opaque CSV of BlockTab enum names ("REGISTRY,TRAVEL") - parsed by frontend
    @Column(name = "hidden_tabs", length = 500)
    private String hiddenTabs;

    // V34: opaque JSON map of tab → custom label - parsed by frontend
    @Column(name = "custom_tab_labels", columnDefinition = "NVARCHAR(MAX)")
    private String customTabLabels;

    @Column(name = "is_deleted", nullable = false)
    private boolean isDeleted;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

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
