package com.altarwed.domain.model;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure-JUnit domain tests for MetricsSnapshot. No Spring context per backend/CLAUDE.md convention.
 */
class MetricsSnapshotTest {

    @Test
    void canonicalConstructor_normalizesNullSignupToPublishedRateToZero() {
        // Exercises the null guard in the compact constructor:
        //   signupToPublishedRate = signupToPublishedRate == null ? 0.0d : signupToPublishedRate;
        // The 21-arg adapter constructor cannot reach this branch (it hardcodes 0.0d);
        // only a direct canonical call with null can.
        MetricsSnapshot snap = new MetricsSnapshot(
                0L, 0L, 0L,
                0L, 0L,
                0L, 0L, 0L,
                0L, 0L, 0L,
                0L, 0L, 0L,
                0L, 0L, 0L, 0L, 0L,
                List.of(), List.of(),
                null);

        assertThat(snap.signupToPublishedRate()).isNotNull();
        assertThat(snap.signupToPublishedRate()).isEqualTo(0.0d);
        assertThat(snap.signupToPublishedRate()).isNotNaN();
    }

    @Test
    void canonicalConstructor_preservesNonNullSignupToPublishedRate() {
        MetricsSnapshot snap = new MetricsSnapshot(
                0L, 0L, 0L,
                0L, 0L,
                0L, 0L, 0L,
                0L, 0L, 0L,
                0L, 0L, 0L,
                0L, 0L, 0L, 0L, 0L,
                List.of(), List.of(),
                0.75d);

        assertThat(snap.signupToPublishedRate()).isEqualTo(0.75d);
    }
}
