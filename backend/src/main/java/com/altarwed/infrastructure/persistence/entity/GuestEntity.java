package com.altarwed.infrastructure.persistence.entity;

import com.altarwed.domain.model.GuestRsvpStatus;
import com.altarwed.domain.model.GuestSide;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "guests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GuestEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "couple_id", nullable = false)
    private UUID coupleId;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "email", length = 300)
    private String email;

    @Column(name = "phone", length = 50)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(name = "rsvp_status", nullable = false, length = 20)
    private GuestRsvpStatus rsvpStatus;

    @Column(name = "plus_one_allowed", nullable = false)
    private boolean plusOneAllowed;

    @Column(name = "plus_one_name", length = 200)
    private String plusOneName;

    @Column(name = "dietary_restrictions", length = 500)
    private String dietaryRestrictions;

    @Column(name = "table_number")
    private Integer tableNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "side", length = 10)
    private GuestSide side;

    @Column(name = "notes", columnDefinition = "NVARCHAR(MAX)")
    private String notes;

    @Column(name = "invite_sent_at")
    private LocalDateTime inviteSentAt;

    @Column(name = "responded_at")
    private LocalDateTime respondedAt;

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
