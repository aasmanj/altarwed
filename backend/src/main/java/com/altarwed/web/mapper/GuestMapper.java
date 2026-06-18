package com.altarwed.web.mapper;

import com.altarwed.application.dto.GuestDeliverySummary;
import com.altarwed.application.dto.GuestResponse;
import com.altarwed.domain.model.Guest;
import org.springframework.stereotype.Component;

@Component
public class GuestMapper {

    // Single-guest responses (add/update/invite/table) have no delivery rollup to
    // merge; the list endpoint uses the overload below.
    public GuestResponse toResponse(Guest g) {
        return toResponse(g, null);
    }

    public GuestResponse toResponse(Guest g, GuestDeliverySummary delivery) {
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
                delivery != null ? delivery.inviteDeliveryStatus() : null
        );
    }
}
