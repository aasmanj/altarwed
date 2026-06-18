package com.altarwed.application.dto;

import com.altarwed.domain.model.GuestRsvpStatus;
import com.altarwed.domain.model.GuestSide;

import java.time.LocalDateTime;
import java.util.UUID;
import com.altarwed.domain.model.GuestRsvpStatus;
import com.altarwed.domain.model.GuestSide;

public record GuestResponse(
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
        String mailLine1,
        String mailCity,
        String mailState,
        String mailZip,
        String mailCountry,
        String noteForCouple,
        Integer inviteSendCount,
        LocalDateTime inviteSentAt,
        LocalDateTime saveTheDateSentAt,
        LocalDateTime respondedAt,
        LocalDateTime remindAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        UUID partyId,
        String partyName,
        Boolean partyContact,
        // Latest Resend delivery outcome per email type (DELIVERED / BOUNCED /
        // COMPLAINED / DELAYED / SENT), or null when no webhook event has arrived.
        // Distinct from saveTheDateSentAt/inviteSentAt, which only record that we
        // attempted the send.
        String saveTheDateDeliveryStatus,
        String inviteDeliveryStatus
) {}
