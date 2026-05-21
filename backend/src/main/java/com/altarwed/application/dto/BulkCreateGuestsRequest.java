package com.altarwed.application.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Wraps a list of CreateGuestRequest for the bulk-import endpoint.
 * Used by both CSV import (client parses the file and sends parsed rows)
 * and any other bulk-add flow. Capped at 500 guests per request.
 */
public record BulkCreateGuestsRequest(
        @NotEmpty @Size(max = 500) @Valid List<CreateGuestRequest> guests
) {}
