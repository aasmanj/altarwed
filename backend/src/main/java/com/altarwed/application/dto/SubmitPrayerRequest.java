package com.altarwed.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SubmitPrayerRequest(
        @NotBlank @Size(max = 200) String guestName,
        @NotBlank @Size(max = 2000) String prayerText
) {}
