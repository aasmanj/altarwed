package com.altarwed.web.mapper;

import com.altarwed.application.dto.GuestDeliverySummary;
import com.altarwed.application.dto.GuestResponse;
import com.altarwed.domain.model.Guest;
import org.springframework.stereotype.Component;

@Component
public class GuestMapper {

    // Bulk/party responses for brand-new guests carry no delivery rollup or
    // suppression status; those resolve on the next guest-list fetch.
    public GuestResponse toResponse(Guest g) {
        return toResponse(g, null, null);
    }

    // Single-guest write responses (add/update/invite/table): no delivery rollup, but
    // carry the per-couple suppression reason so the dashboard's optimistic cache keeps
    // the unsubscribe badge accurate after the mutation.
    public GuestResponse toResponse(Guest g, String unsubscribedReason) {
        return toResponse(g, null, unsubscribedReason);
    }

    public GuestResponse toResponse(Guest g, GuestDeliverySummary delivery, String unsubscribedReason) {
        return new GuestResponse(
                g.id(), g.coupleId(), g.name(), g.email(), g.phone(),
                g.rsvpStatus(), g.plusOneAllowed(), g.plusOneName(),
                g.dietaryRestrictions(), g.songRequest(),
                g.tableNumber(), g.side(), g.notes(),
                g.mailLine1(), g.mailCity(), g.mailState(), g.mailZip(), g.mailCountry(),
                g.noteForCouple(), g.inviteSendCount(),
                g.inviteSentAt(), g.saveTheDateSentAt(), g.respondedAt(), g.remindAt(), g.createdAt(), g.updatedAt(),
                g.partyId(), g.partyName(), g.partyContact(),
                delivery != null ? delivery.saveTheDateDeliveryStatus() : null,
                delivery != null ? delivery.inviteDeliveryStatus() : null,
                unsubscribedReason != null,
                unsubscribedReason
        );
    }
}
