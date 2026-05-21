package com.altarwed.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SetGoogleSheetSyncRequest(
        @NotBlank @Size(max = 2000) String sheetUrl
) {}
