package com.altarwed.application.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Toggles a vendor's own listing visibility. active=false pauses (hidden from the directory, no
 * new inquiries); active=true resumes. Boxed Boolean so a missing field is a 400, not silently false.
 */
public record ListingStatusRequest(@NotNull Boolean active) {}
