package com.altarwed.application.dto;

// Returned from POST /api/v1/google-sheet-sync/couple/{coupleId}/trigger.
// Wraps the persisted sync state with transient counts describing what just
// happened in this run, used by the dashboard to show a toast like
// "Synced: 3 added, 7 updated."
public record TriggerSyncResponse(
        GoogleSheetSyncResponse sync,
        Integer added,
        Integer updated
) {}
