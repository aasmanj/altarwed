package com.altarwed.application.dto;

/**
 * Returned by the public "find your invitation" endpoint.
 * The maskedName is a privacy-safe display (e.g. "Jordan A.").
 * The token is a short-lived (1 hour) raw token the client uses to load the RSVP page.
 */
public record RsvpFindResult(String maskedName, String token) {}
