package com.altarwed.web.mapper;

import com.altarwed.application.dto.GuestResponse;
import com.altarwed.domain.model.Guest;
import org.springframework.stereotype.Component;

@Component
public class GuestMapper {

    public GuestResponse toResponse(Guest g) {
        return new GuestResponse(
                g.id(), g.coupleId(), g.name(), g.email(), g.phone(),
                g.rsvpStatus(), g.plusOneAllowed(), g.plusOneName(),
                g.dietaryRestrictions(), g.songRequest(),
                g.tableNumber(), g.side(), g.notes(),
                g.mailLine1(), g.mailCity(), g.mailState(), g.mailZip(), g.mailCountry(),
                g.noteForCouple(), g.inviteSendCount(),
                g.inviteSentAt(), g.respondedAt(), g.remindAt(), g.createdAt(), g.updatedAt(),
                g.partyId(), g.partyName(), g.partyContact()
        );
    }
}
