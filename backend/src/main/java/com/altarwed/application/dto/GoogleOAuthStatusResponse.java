package com.altarwed.application.dto;

public record GoogleOAuthStatusResponse(
        Boolean connected,
        String googleEmail
) {}
