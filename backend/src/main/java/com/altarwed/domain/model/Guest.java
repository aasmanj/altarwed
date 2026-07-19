package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.UUID;

public record Guest(
        UUID id,
        UUID coupleId,
        String name,
        String email,
        String phone,
        GuestRsvpStatus rsvpStatus,
        boolean plusOneAllowed,
        String plusOneName,
        String dietaryRestrictions,
        String songRequest,
        Integer tableNumber,
        GuestSide side,
        String notes,
        // Structured mailing address for physical mail (Lob.com postcards).
        // All four fields must be non-null to submit a postcard for this guest.
        String mailLine1,
        String mailCity,
        String mailState,
        String mailZip,
        // null means domestic US; any non-null value enables international routing in Lob
        String mailCountry,
        // private note left by the guest on the RSVP form; never returned by any public endpoint
        String noteForCouple,
        // number of invite emails sent for this guest; capped to prevent spamming
        Integer inviteSendCount,
        LocalDateTime inviteSentAt,
        // when the save-the-date email was last sent to this guest; null = never sent
        LocalDateTime saveTheDateSentAt,
        LocalDateTime respondedAt,
        // when set, the scheduler re-sends the RSVP invite at this time and then clears the field
        LocalDateTime remindAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        // party support: guests sharing a party_id are grouped together. null = solo guest.
        UUID partyId,
        String partyName,
        // true for the one party member who receives the invite email on behalf of the group
        Boolean partyContact,
        // UUID stamped into the couple's Google Sheet so sync can match rows by ID rather than name.
        // Null for guests added manually or synced before write-back was introduced.
        String sheetSyncId,
        // true when this guest was created by the Google Sheets sync job (not manually added).
        // A guest is eligible for automatic deletion when its sheet row is removed if this
        // flag is true OR sheetSyncId is non-null (the row was the guest's sheet binding).
        boolean syncedFromSheet,
        // V101 (issue #458): date-offset RSVP campaign reminder markers. Each is stamped the
        // moment its reminder is queued, so the hourly CampaignReminderService sends at most one
        // per guest and re-running the job (or a guest re-save) never re-sends. Null = not sent.
        // DATETIMEOFFSET-backed, so OffsetDateTime rather than the LocalDateTime the older
        // timestamps use.
        OffsetDateTime nonresponderReminderSentAt,
        OffsetDateTime attendingReminderSentAt
) {}
