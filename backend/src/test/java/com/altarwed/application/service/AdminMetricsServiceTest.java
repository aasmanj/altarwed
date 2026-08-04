package com.altarwed.application.service;

import com.altarwed.domain.model.MetricsSnapshot;
import com.altarwed.domain.port.MetricsRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminMetricsServiceTest {

    private static final long PRICE_CENTS = 2900L;
    private static final String ADMIN = "founder@altarwed.com";

    @Mock
    private MetricsRepository metricsRepository;

    private AdminMetricsService service;

    @BeforeEach
    void setUp() {
        service = new AdminMetricsService(metricsRepository, new AdminAccessGuard(ADMIN), PRICE_CENTS);
    }

    @Test
    void snapshot_computesMrrFromActivePaidSubscriptionsAndConfiguredPrice() {
        when(metricsRepository.snapshot()).thenReturn(snapshotWith(3L, 0L, 42L));

        MetricsSnapshot result = service.snapshot(ADMIN);

        assertThat(result.activePaidSubscriptions()).isEqualTo(3L);
        assertThat(result.mrrCents()).isEqualTo(3L * PRICE_CENTS); // 8700 cents = $87 MRR
        assertThat(result.totalInquiries()).isEqualTo(42L);
    }

    @Test
    void snapshot_withNoPayingSubscribers_reportsZeroMrr() {
        when(metricsRepository.snapshot()).thenReturn(snapshotWith(0L, 0L, 0L));

        MetricsSnapshot result = service.snapshot(ADMIN);

        assertThat(result.mrrCents()).isEqualTo(0L);
    }

    @Test
    void snapshot_computesSignupToPublishedConversionRate() {
        when(metricsRepository.snapshot()).thenReturn(funnelSnapshot(100L, 40L));

        MetricsSnapshot result = service.snapshot(ADMIN);

        assertThat(result.signupToPublishedRate()).isCloseTo(0.4d, within(1e-9));
        // Raw counts must survive the derivation untouched.
        assertThat(result.totalCouples()).isEqualTo(100L);
        assertThat(result.publishedWebsites()).isEqualTo(40L);
    }

    @Test
    void snapshot_withNoCouples_reportsZeroConversionRateInsteadOfDividingByZero() {
        when(metricsRepository.snapshot()).thenReturn(funnelSnapshot(0L, 0L));

        MetricsSnapshot result = service.snapshot(ADMIN);

        assertThat(result.signupToPublishedRate()).isNotNull();
        assertThat(result.signupToPublishedRate()).isEqualTo(0.0d);
        assertThat(result.signupToPublishedRate()).isNotNaN();
    }

    @Test
    void snapshot_withEveryCouplePublished_reportsFullConversion() {
        when(metricsRepository.snapshot()).thenReturn(funnelSnapshot(7L, 7L));

        MetricsSnapshot result = service.snapshot(ADMIN);

        assertThat(result.signupToPublishedRate()).isEqualTo(1.0d);
    }

    @Test
    void snapshot_conversionRateDoesNotDisturbMrr() {
        when(metricsRepository.snapshot()).thenReturn(snapshotWith(3L, 0L, 42L));

        MetricsSnapshot result = service.snapshot(ADMIN);

        assertThat(result.mrrCents()).isEqualTo(3L * PRICE_CENTS);
        assertThat(result.signupToPublishedRate()).isEqualTo(0.0d);
    }

    @Test
    void rawCountsConstructor_defaultsConversionRateToZeroRatherThanNull() {
        // What MetricsJpaAdapter builds: counts only, no derived rate. Must never be null.
        assertThat(funnelSnapshot(10L, 5L).signupToPublishedRate()).isEqualTo(0.0d);
    }

    @Test
    void snapshot_forNonAdmin_isDenied() {
        assertThatThrownBy(() -> service.snapshot("stranger@example.com"))
                .isInstanceOf(AccessDeniedException.class);
    }

    // Builds a snapshot with only the fields under test populated; everything else zeroed.
    private MetricsSnapshot snapshotWith(long activePaidSubscriptions, long mrrCents, long totalInquiries) {
        return new MetricsSnapshot(
                0L, 0L, 0L,
                0L, 0L,
                0L, 0L, 0L,
                0L, 0L, 0L,
                activePaidSubscriptions, mrrCents, totalInquiries,
                0L, 0L, 0L, 0L, 0L,
                List.of(), List.of());
    }

    // Builds a snapshot carrying only the two funnel counts; the adapter never supplies a rate,
    // so this uses the same raw-counts constructor MetricsJpaAdapter does.
    private MetricsSnapshot funnelSnapshot(long totalCouples, long publishedWebsites) {
        return new MetricsSnapshot(
                totalCouples, 0L, 0L,
                0L, publishedWebsites,
                0L, 0L, 0L,
                0L, 0L, 0L,
                0L, 0L, 0L,
                0L, 0L, 0L, 0L, 0L,
                List.of(), List.of());
    }
}
