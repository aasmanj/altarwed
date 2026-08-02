package com.altarwed;

import com.altarwed.domain.port.VendorRepository;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Behavioral proof of issue #554 part 1 against a REAL SQL Server: the atomic founding-slot
 * allocation ({@link VendorRepository#tryClaimFoundingSlot(long)} -> the conditional UPDATE on
 * founding_program) admits EXACTLY the remaining number of slots even when many callers race for
 * them at once. The old check-then-act gate (countVerified() &lt; cap, then grant) could admit more
 * than the cap under this same burst.
 *
 * Why this needs a real database (tagged "schema-validation", run by the schemaValidationTest task):
 * the guarantee comes from SQL Server serializing concurrent UPDATEs on the single founding_program
 * row's exclusive lock under READ COMMITTED. H2 or a mock cannot reproduce that, so the atomicity can
 * only be proven on the prod dialect. The default ./gradlew test skips this tag.
 */
@Tag("schema-validation")
@SpringBootTest
@ActiveProfiles("ci")
class FoundingCapRaceConcurrencyTest {

    @Autowired private VendorRepository vendorRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    void concurrentClaims_admitExactlyTheRemainingSlots_neverMore() throws Exception {
        // Migration V106 must have created and seeded the counter row.
        Integer baseline = jdbcTemplate.queryForObject(
                "SELECT slots_claimed FROM founding_program WHERE program_key = 'FOUNDING_25'",
                Integer.class);
        assertThat(baseline).as("V106 seeds exactly one FOUNDING_25 counter row").isNotNull();

        int slotsToOffer = 5;
        int racers = 40;
        // cap is baseline + slotsToOffer, so from the current counter value exactly slotsToOffer more
        // claims may succeed no matter how many threads race.
        long cap = baseline + slotsToOffer;

        ExecutorService pool = Executors.newFixedThreadPool(racers);
        CountDownLatch startGun = new CountDownLatch(1);
        List<Future<Boolean>> results = new ArrayList<>();
        try {
            for (int i = 0; i < racers; i++) {
                Callable<Boolean> claim = () -> {
                    startGun.await();
                    return vendorRepository.tryClaimFoundingSlot(cap);
                };
                results.add(pool.submit(claim));
            }
            // Release all threads at once to maximise contention on the counter row.
            startGun.countDown();

            AtomicInteger winners = new AtomicInteger(0);
            for (Future<Boolean> r : results) {
                if (Boolean.TRUE.equals(r.get(30, TimeUnit.SECONDS))) {
                    winners.incrementAndGet();
                }
            }

            assertThat(winners.get())
                    .as("exactly the remaining founding slots are granted, never more, under a burst")
                    .isEqualTo(slotsToOffer);

            Integer finalClaimed = jdbcTemplate.queryForObject(
                    "SELECT slots_claimed FROM founding_program WHERE program_key = 'FOUNDING_25'",
                    Integer.class);
            assertThat(finalClaimed)
                    .as("the counter lands exactly at the cap, proving no over-increment")
                    .isEqualTo((int) cap);
        } finally {
            pool.shutdownNow();
            // Restore the shared counter so reruns and other schema-validation tests see the seed value.
            jdbcTemplate.update(
                    "UPDATE founding_program SET slots_claimed = ? WHERE program_key = 'FOUNDING_25'",
                    baseline);
        }
    }
}
