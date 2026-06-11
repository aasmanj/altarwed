package com.altarwed.application.service;

import com.altarwed.domain.exception.GoogleAuthRevokedException;
import com.altarwed.domain.model.GoogleSheetSync;
import com.altarwed.domain.model.Guest;
import com.altarwed.domain.model.GuestRsvpStatus;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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
        verify(syncRepository).save(saved.capture());
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
        verify(syncRepository).save(saved.capture());
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
        verify(syncRepository).save(saved.capture());
        assertThat(saved.getValue().isActive()).isTrue();
        assertThat(saved.getValue().lastError()).isNull();
    }

    /**
     * Locks in the reconciliation bug found in prod logs on 2026-06-11: guests imported
     * before sheet sync existed have syncedFromSheet=false, but once their UUID is stamped
     * into the sheet (sheetSyncId != null) the row IS their sheet binding, so deleting the
     * row must delete the guest. Guests never bound to a row (sheetSyncId == null,
     * syncedFromSheet=false) must survive.
     */
    @Test
    void rowDeletion_removesGuestStampedIntoSheet_evenIfImportedBeforeSync() {
        UUID coupleId = UUID.randomUUID();
        GoogleSheetSync sync = activeSync(coupleId);

        String johnUuid  = UUID.randomUUID().toString();
        String faithUuid = UUID.randomUUID().toString();
        Guest johnInSheet   = guest(coupleId, "John Smith", johnUuid, false);
        Guest faithRemoved  = guest(coupleId, "Faith Rezentez", faithUuid, false);
        Guest manualNoRow   = guest(coupleId, "Manual Guest", null, false);

        when(syncRepository.findAllActive()).thenReturn(List.of(sync));
        when(googleOAuthService.hasOAuthTokens(coupleId)).thenReturn(true);
        // Sheet now contains only John; Faith's row was deleted by the couple.
        when(googleOAuthService.readSheet(any(), any())).thenReturn(List.of(
                new String[]{"Guest Name(s)", "AltarWed ID (do not modify)"},
                new String[]{"John Smith", johnUuid}
        ));
        when(guestRepository.findAllByCoupleId(coupleId))
                .thenReturn(List.of(johnInSheet, faithRemoved, manualNoRow));
        when(syncRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        int[] counts = service().runAllActive();

        assertThat(counts).containsExactly(1, 0);
        verify(guestRepository).deleteById(faithRemoved.id());
        verify(guestRepository, never()).deleteById(johnInSheet.id());
        verify(guestRepository, never()).deleteById(manualNoRow.id());
    }

    /**
     * Locks in the orphaned-stamp recovery found in the pre-push review: when a guest's
     * UUID was saved to the DB but the sheet write-back failed (e.g. the 403
     * readonly-scope case), the next run must re-match that guest by name, reuse its
     * existing stamp, and repair the cell, NOT create a duplicate and delete the
     * original (which would destroy RSVP history).
     */
    @Test
    void orphanedStamp_isRematchedByName_notDuplicatedOrDeleted() {
        UUID coupleId = UUID.randomUUID();
        GoogleSheetSync sync = activeSync(coupleId);

        String orphanUuid = UUID.randomUUID().toString();
        Guest orphan = guest(coupleId, "Orphan Guest", orphanUuid, false);

        when(syncRepository.findAllActive()).thenReturn(List.of(sync));
        when(googleOAuthService.hasOAuthTokens(coupleId)).thenReturn(true);
        // The guest's row is present but its ID cell is empty: the stamp never landed.
        when(googleOAuthService.readSheet(any(), any())).thenReturn(List.of(
                new String[]{"Guest Name(s)", "AltarWed ID (do not modify)"},
                new String[]{"Orphan Guest", ""}
        ));
        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(orphan));
        when(syncRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        int[] counts = service().runAllActive();

        assertThat(counts).containsExactly(1, 0);
        verify(guestRepository, never()).deleteById(any());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Guest>> saved = ArgumentCaptor.forClass(List.class);
        verify(guestRepository).saveAll(saved.capture());
        assertThat(saved.getValue()).isEmpty(); // re-matched + unchanged: no duplicate, no rewrite

        @SuppressWarnings("unchecked")
        ArgumentCaptor<java.util.Map<String, String>> cells = ArgumentCaptor.forClass(java.util.Map.class);
        verify(googleOAuthService).writeSheetCells(any(), any(), cells.capture());
        assertThat(cells.getValue()).containsValue(orphanUuid); // cell repaired with the SAME stamp
    }

    /**
     * Junk typed into the "AltarWed ID" cell must be treated as unstamped, never
     * persisted raw (sheet_sync_id is NVARCHAR(36); oversized junk would abort the
     * batch exactly like the oversized zip did in prod).
     */
    @Test
    void junkIdCell_isTreatedAsUnstamped_andRepairedWithAFreshUuid() {
        UUID coupleId = UUID.randomUUID();
        GoogleSheetSync sync = activeSync(coupleId);

        when(syncRepository.findAllActive()).thenReturn(List.of(sync));
        when(googleOAuthService.hasOAuthTokens(coupleId)).thenReturn(true);
        when(googleOAuthService.readSheet(any(), any())).thenReturn(List.of(
                new String[]{"Guest Name(s)", "AltarWed ID (do not modify)"},
                new String[]{"New Guest", "definitely not a uuid and way longer than thirty-six characters"}
        ));
        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of());
        when(syncRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        int[] counts = service().runAllActive();

        assertThat(counts).containsExactly(1, 0);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Guest>> saved = ArgumentCaptor.forClass(List.class);
        verify(guestRepository).saveAll(saved.capture());
        assertThat(saved.getValue()).hasSize(1);
        String storedId = saved.getValue().get(0).sheetSyncId();
        assertThat(UUID.fromString(storedId)).isNotNull(); // canonical UUID, not the junk
    }

    @Test
    void parseSheetUuid_acceptsOnlyRealUuids() {
        assertThat(GoogleSheetSyncService.parseSheetUuid(null)).isNull();
        assertThat(GoogleSheetSyncService.parseSheetUuid("   ")).isNull();
        assertThat(GoogleSheetSyncService.parseSheetUuid("not-a-uuid")).isNull();
        // UUID.fromString alone would parse this; non-canonical input must be rejected
        // or several junk cells could alias to one canonicalized UUID.
        assertThat(GoogleSheetSyncService.parseSheetUuid("1-2-3-4-5")).isNull();
        String u = UUID.randomUUID().toString();
        assertThat(GoogleSheetSyncService.parseSheetUuid("  " + u + "  ")).isEqualTo(u);
    }

    @Test
    void clamp_trimsAndTruncatesOversizedSheetValues() {
        assertThat(GoogleSheetSyncService.clamp(null, 20)).isNull();
        assertThat(GoogleSheetSyncService.clamp("  T1A 0W3  ", 20)).isEqualTo("T1A 0W3");
        // the prod failure: country text spilled into the Zip column, exceeding NVARCHAR width
        assertThat(GoogleSheetSyncService.clamp("Canada T1A 0W3 please forward", 20))
                .isEqualTo("Canada T1A 0W3 pleas");
    }

    private Guest guest(UUID coupleId, String name, String sheetSyncId, boolean syncedFromSheet) {
        return new Guest(
                UUID.randomUUID(), coupleId, name, null, null,
                GuestRsvpStatus.PENDING, false, null, null, null,
                null, null, null,
                null, null, null, null, null,
                null, 0,
                null, null, null, null, null,
                null, null, null,
                sheetSyncId, syncedFromSheet);
    }
}
