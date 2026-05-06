package com.altarwed.application.dto;

import jakarta.validation.constraints.NotBlank;

public record VerifyPinRequest(@NotBlank String pin) {}
