package com.altarwed.infrastructure.persistence.entity;

import com.altarwed.domain.model.GuestRsvpStatus;
import com.altarwed.domain.model.GuestSide;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
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

    @Column(name = "song_request", length = 200)
    private String songRequest;

    @Column(name = "shuttle_needed")
    private Boolean shuttleNeeded;

    @Column(name = "table_number")
    private Integer tableNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "side", length = 10)
    private GuestSide side;

    @Column(name = "notes", columnDefinition = "NVARCHAR(MAX)")
    private String notes;

    @Column(name = "mail_line1", length = 200)
    private String mailLine1;

    @Column(name = "mail_city", length = 100)
    private String mailCity;

    @Column(name = "mail_state", length = 100)
    private String mailState;

    @Column(name = "mail_zip", length = 20)
    private String mailZip;

    @Column(name = "mail_country", length = 100)
    private String mailCountry;

    @Column(name = "note_for_couple", length = 1000)
    private String noteForCouple;

    @Column(name = "invite_send_count", nullable = false)
    private Integer inviteSendCount;

    @Column(name = "invite_sent_at")
    private LocalDateTime inviteSentAt;

    @Column(name = "save_the_date_sent_at")
    private LocalDateTime saveTheDateSentAt;

    @Column(name = "responded_at")
    private LocalDateTime respondedAt;

    @Column(name = "remind_at")
    private LocalDateTime remindAt;

    @Column(name = "party_id")
    private UUID partyId;

    @Column(name = "party_name", length = 100)
    private String partyName;

    @Column(name = "party_contact", nullable = false)
    private Boolean partyContact;

    @Column(name = "sheet_sync_id", length = 36)
    private String sheetSyncId;

    @Column(name = "synced_from_sheet", nullable = false)
    private boolean syncedFromSheet;

    // V101 (issue #458): campaign reminder sent-markers. DATETIMEOFFSET columns map to
    // OffsetDateTime and need columnDefinition rather than length=n (SQL Server convention).
    @Column(name = "nonresponder_reminder_sent_at", columnDefinition = "DATETIMEOFFSET")
    private OffsetDateTime nonresponderReminderSentAt;

    @Column(name = "attending_reminder_sent_at", columnDefinition = "DATETIMEOFFSET")
    private OffsetDateTime attendingReminderSentAt;

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
