package com.altarwed.application.dto;

// Used by PUT /api/v1/guests/couple/{coupleId}/{guestId}/table.
// tableNumber null means "remove from table" (unassign). This is intentionally
// a dedicated DTO rather than reusing UpdateGuestRequest, the general PATCH
// endpoint uses a null-means-not-provided merge pattern that cannot express
// clearing a nullable field back to null.
public record AssignTableRequest(Integer tableNumber) {}
