package com.altarwed.infrastructure.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Per-vendor inbound inquiry cap (issue #100). The adapter is deliberately dumb
 * (one bucket per vendor key, Bucket4j greedy refill); these tests pin the two
 * properties the service relies on: the cap boundary is exact, and vendors are
 * fully isolated from each other's budgets.
 */
class InMemoryInquiryThrottleAdapterTest {

    @Test
    void allowsExactlyTheBudgetThenRejects() {
        var adapter = new InMemoryInquiryThrottleAdapter();

        for (int i = 0; i < InMemoryInquiryThrottleAdapter.INQUIRY_BUDGET; i++) {
            assertThat(adapter.tryAcquire("vendor-a"))
                    .as("inquiry %d of %d should be within budget", i + 1, InMemoryInquiryThrottleAdapter.INQUIRY_BUDGET)
                    .isTrue();
        }

        assertThat(adapter.tryAcquire("vendor-a"))
                .as("inquiry over the budget must be rejected")
                .isFalse();
    }

    @Test
    void oneVendorsExhaustedBudgetDoesNotAffectAnotherVendor() {
        var adapter = new InMemoryInquiryThrottleAdapter();

        for (int i = 0; i < InMemoryInquiryThrottleAdapter.INQUIRY_BUDGET; i++) {
            adapter.tryAcquire("vendor-a");
        }
        assertThat(adapter.tryAcquire("vendor-a")).isFalse();

        // The throttle is keyed per target vendor: flooding vendor A must never
        // block couples from reaching vendor B.
        assertThat(adapter.tryAcquire("vendor-b")).isTrue();
    }

    @Test
    void rejectionDoesNotResetOrCorruptTheBucket() {
        var adapter = new InMemoryInquiryThrottleAdapter();

        for (int i = 0; i < InMemoryInquiryThrottleAdapter.INQUIRY_BUDGET; i++) {
            adapter.tryAcquire("vendor-a");
        }

        // Hammering an exhausted bucket keeps rejecting; it must not accidentally
        // mint a fresh bucket (which would defeat the cap under sustained flood).
        for (int i = 0; i < 5; i++) {
            assertThat(adapter.tryAcquire("vendor-a")).isFalse();
        }
    }
}
