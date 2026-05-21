package com.altarwed.application.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Creates a group of guests who share a party_id. The first guest in the list
 * (index 0) is automatically marked as the party contact who will receive the
 * invite email on behalf of the group.
 */
public record CreatePartyRequest(
        @NotBlank @Size(max = 100) String partyName,
        @NotEmpty @Valid List<CreateGuestRequest> members
) {}
