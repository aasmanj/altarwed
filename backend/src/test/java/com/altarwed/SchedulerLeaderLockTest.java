package com.altarwed;

import com.altarwed.application.service.GoogleSheetSyncService;
import com.altarwed.application.service.RsvpReminderService;
import com.altarwed.domain.port.GuestRepository;
import com.altarwed.infrastructure.scheduler.GoogleSheetPollingJob;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Issue #44: @Scheduled pollers ran with no leader lock, so the instant App Service scales past
 * one instance, every due RSVP reminder is emailed twice and every active sheet synced twice in
 * the same window. This proves ShedLock's SQL Server-backed lock (V82 migration, {@code
 * shedlock} table) actually serializes concurrent callers against a real SQL Server dialect,
 * which an H2/mock test cannot prove (SQL Server's UPDATE ... WHERE lock_until <= @P0 semantics
 * are dialect-specific). Tagged "schema-validation" for the same reason as
 * {@link SchemaValidationTest}: it needs the real DB, not the default `./gradlew test` H2/mock path.
 *
 * Two threads call the same @SchedulerLock-annotated bean method (through the Spring AOP proxy,
 * which is what actually enforces the lock -- a same-class self-call would bypass it) at the same
 * moment via a CountDownLatch starting gate. Only one thread's call should reach the underlying
 * work; the loser is silently skipped by ShedLock's interceptor (no exception, no block).
 */
@Tag("schema-validation")
@SpringBootTest
@ActiveProfiles("ci")
class SchedulerLeaderLockTest {

    @Autowired
    private RsvpReminderService rsvpReminderService;

    @Autowired
    private GoogleSheetPollingJob googleSheetPollingJob;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private GuestRepository guestRepository;

    @MockitoBean
    private GoogleSheetSyncService googleSheetSyncService;

    @Test
    void shedlockTableExistsAfterMigration() {
        Integer matches = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sys.tables WHERE name = 'shedlock'", Integer.class);

        assertThat(matches).as("V82 must create the shedlock table").isEqualTo(1);
    }

    @Test
    void concurrentSendDueReminders_onlyOneCallerRunsTheBody() throws InterruptedException {
        when(guestRepository.findDueReminders(any(LocalDateTime.class))).thenReturn(Collections.emptyList());

        runConcurrently(rsvpReminderService::sendDueReminders);

        // Both threads called the annotated method; ShedLock must have let exactly one of them
        // reach the body (the only place findDueReminders is invoked).
        verify(guestRepository, times(1)).findDueReminders(any(LocalDateTime.class));
    }

    @Test
    void concurrentGoogleSheetPoll_onlyOneCallerRunsTheBody() throws InterruptedException {
        when(googleSheetSyncService.runAllActive()).thenReturn(new int[]{0, 0});

        runConcurrently(googleSheetPollingJob::poll);

        verify(googleSheetSyncService, times(1)).runAllActive();
    }

    /** Fires {@code task} from two threads as close to simultaneously as a CountDownLatch allows. */
    private void runConcurrently(Runnable task) throws InterruptedException {
        int callers = 2;
        ExecutorService pool = Executors.newFixedThreadPool(callers);
        CountDownLatch startGate = new CountDownLatch(1);
        CountDownLatch doneGate = new CountDownLatch(callers);
        try {
            for (int i = 0; i < callers; i++) {
                pool.submit(() -> {
                    try {
                        startGate.await();
                        task.run();
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    } finally {
                        doneGate.countDown();
                    }
                });
            }
            startGate.countDown();
            assertThat(doneGate.await(30, TimeUnit.SECONDS))
                    .as("both callers must finish (the losing caller is skipped, not blocked)")
                    .isTrue();
        } finally {
            pool.shutdownNow();
        }
    }
}
