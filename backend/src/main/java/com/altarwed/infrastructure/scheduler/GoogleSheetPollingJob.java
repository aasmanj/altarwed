package com.altarwed.infrastructure.scheduler;

import com.altarwed.application.service.GoogleSheetSyncService;
import com.altarwed.infrastructure.persistence.GoogleOAuthTokenAdapter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Polls all active Google Sheet sync configs every 15 minutes.
 *
 * fixedDelay means "15 min after the previous run completes", so if a sync
 * round takes time, runs don't pile up. This is important for a single-instance
 * deployment where concurrent syncs could hit rate limits.
 *
 * Interview note: fixedDelay vs fixedRate, fixedRate fires on a wall-clock
 * schedule regardless of how long each run takes (can stack up if slow);
 * fixedDelay waits N ms after the previous run finishes (safer for I/O-heavy jobs).
 */
@Component
public class GoogleSheetPollingJob {

    private static final Logger log = LoggerFactory.getLogger(GoogleSheetPollingJob.class);

    private final GoogleSheetSyncService syncService;
    private final GoogleOAuthTokenAdapter oauthTokenAdapter;

    public GoogleSheetPollingJob(GoogleSheetSyncService syncService, GoogleOAuthTokenAdapter oauthTokenAdapter) {
        this.syncService = syncService;
        this.oauthTokenAdapter = oauthTokenAdapter;
    }

    @Scheduled(fixedDelay = 900_000)   // 15 minutes in ms
    public void poll() {
        UUID runId = UUID.randomUUID();
        long startMs = System.currentTimeMillis();
        log.info("google sheet poll started, runId={}", runId);
        try {
            int[] counts = syncService.runAllActive();
            // Issue #42 self-heal visibility: rows converge to encrypted on their next save, but
            // an inactive/never-synced connection never triggers one, so this count is the only
            // signal that some rows are still plaintext at rest.
            long legacyPlaintextTokens = oauthTokenAdapter.countLegacyPlaintextTokens();
            log.info("google sheet poll finished, runId={}, succeeded={}, failed={}, legacyPlaintextTokens={}, durationMs={}",
                     runId, counts[0], counts[1], legacyPlaintextTokens, System.currentTimeMillis() - startMs);
        } catch (Exception ex) {
            log.error("google sheet poll crashed, runId={}, durationMs={}",
                      runId, System.currentTimeMillis() - startMs, ex);
            throw ex;
        }
    }
}
