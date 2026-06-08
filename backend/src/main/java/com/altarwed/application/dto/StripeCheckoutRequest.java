package com.altarwed.application.dto;

import jakarta.validation.constraints.NotBlank;

public record StripeCheckoutRequest(
        @NotBlank String priceId
) {}
