package com.altarwed.application.dto;

/**
 * Config the browser needs to open the Google Picker for selecting a sheet.
 *
 * @param accessToken a fresh drive.file-scoped OAuth access token for the couple
 *                    (short-lived; used only client-side to authorize the Picker)
 * @param apiKey      browser API key restricted to our referrers + the Picker/Sheets APIs
 * @param appId       numeric Cloud project number; ties the Picker selection to our
 *                    OAuth client so the drive.file grant persists for server-side sync
 * @param configured  false until apiKey and appId are wired, so the frontend can show
 *                    a clear message instead of opening a Picker that will fail
 */
public record GooglePickerConfigResponse(
        String accessToken,
        String apiKey,
        String appId,
        boolean configured
) {}
