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
}
