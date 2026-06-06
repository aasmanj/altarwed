package com.altarwed.application.service;

import com.altarwed.domain.exception.GoogleAuthRevokedException;
import com.altarwed.domain.model.GoogleSheetSync;
import com.altarwed.domain.port.GoogleSheetSyncRepository;
import com.altarwed.domain.port.GuestRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the scheduled-sync outcome accounting and the terminal
 * (revoked-token) handling in {@link GoogleSheetSyncService#runAllActive()}.
 *
 * These lock in two bugs found in prod logs on 2026-06-06:
 *   1. runSync swallowed its own exceptions and returned normally, so the batch
 *      always counted a failed run as succeeded (logged "succeeded=1, failed=0"
 *      for a run that errored with invalid_grant).
 *   2. A revoked Google refresh token (invalid_grant) is unrecoverable, but the
 *      sync stayed active and re-threw a full stack trace every 15-min poll.
 */
@ExtendWith(MockitoExtension.class)
class GoogleSheetSyncServiceTest {

    @Mock private GoogleSheetSyncRepository syncRepository;
    @Mock private GuestRepository guestRepository;
    @Mock private GoogleOAuthService googleOAuthService;

    private GoogleSheetSyncService service() {
        return new GoogleSheetSyncService(syncRepository, guestRepository, googleOAuthService);
    }

    private GoogleSheetSync activeSync(UUID coupleId) {
        return new GoogleSheetSync(
                UUID.randomUUID(), coupleId,
                "https://docs.google.com/spreadsheets/d/abc123ABC_def/edit",
                null, null, null, true, LocalDateTime.now(), null);
    }

    @Test
    void revokedToken_isCountedAsFailed_andDeactivatesTheSync() {
        UUID coupleId = UUID.randomUUID();
        GoogleSheetSync sync = activeSync(coupleId);
        when(syncRepository.findAllActive()).thenReturn(List.of(sync));
        when(googleOAuthService.hasOAuthTokens(coupleId)).thenReturn(true);
        when(googleOAuthService.readSheet(any(), any()))
                .thenThrow(new GoogleAuthRevokedException(coupleId));
        when(syncRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        int[] counts = service().runAllActive();

        assertThat(counts).containsExactly(0, 1); // [succeeded, failed]

        ArgumentCaptor<GoogleSheetSync> saved = ArgumentCaptor.forClass(GoogleSheetSync.class);
        org.mockito.Mockito.verify(syncRepository).save(saved.capture());
        assertThat(saved.getValue().isActive()).isFalse();
        assertThat(saved.getValue().lastError()).contains("Reconnect your Google account");
    }

    @Test
    void transientError_isCountedAsFailed_butKeepsTheSyncActive() {
        UUID coupleId = UUID.randomUUID();
        GoogleSheetSync sync = activeSync(coupleId);
        when(syncRepository.findAllActive()).thenReturn(List.of(sync));
        when(googleOAuthService.hasOAuthTokens(coupleId)).thenReturn(true);
        when(googleOAuthService.readSheet(any(), any()))
                .thenThrow(new RuntimeException("Google Sheets returned HTML instead of CSV"));
        when(syncRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        int[] counts = service().runAllActive();

        assertThat(counts).containsExactly(0, 1);

        ArgumentCaptor<GoogleSheetSync> saved = ArgumentCaptor.forClass(GoogleSheetSync.class);
        org.mockito.Mockito.verify(syncRepository).save(saved.capture());
        assertThat(saved.getValue().isActive()).isTrue(); // transient: retry next poll
        assertThat(saved.getValue().lastError()).contains("HTML instead of CSV");
    }

    @Test
    void successfulSync_isCountedAsSucceeded() {
        UUID coupleId = UUID.randomUUID();
        GoogleSheetSync sync = activeSync(coupleId);
        when(syncRepository.findAllActive()).thenReturn(List.of(sync));
        when(googleOAuthService.hasOAuthTokens(coupleId)).thenReturn(true);
        // Empty sheet short-circuits to UpsertCounts(0,0,0) without touching guests.
        when(googleOAuthService.readSheet(any(), any())).thenReturn(List.of());
        when(syncRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        int[] counts = service().runAllActive();

        assertThat(counts).containsExactly(1, 0);

        ArgumentCaptor<GoogleSheetSync> saved = ArgumentCaptor.forClass(GoogleSheetSync.class);
        org.mockito.Mockito.verify(syncRepository).save(saved.capture());
        assertThat(saved.getValue().isActive()).isTrue();
        assertThat(saved.getValue().lastError()).isNull();
    }
}
