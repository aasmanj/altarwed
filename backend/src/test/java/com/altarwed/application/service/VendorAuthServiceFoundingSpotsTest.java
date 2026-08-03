package com.altarwed.application.service;

import com.altarwed.application.dto.FoundingSpotsResponse;
import com.altarwed.domain.port.RefreshTokenRepository;
import com.altarwed.domain.port.VendorRepository;
import com.altarwed.infrastructure.security.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the public founding-spots counter. It must read the SAME
 * slots_claimed counter the registration gate consumes (issue #554), never the
 * broader countVerified() (which also counts paid/comped verifications and
 * would under-report remaining spots), clamp at zero if the counter ever
 * exceeds the cap, and read as a disabled program when the cap is 0.
 */
class VendorAuthServiceFoundingSpotsTest {

    private final VendorRepository vendorRepository = mock(VendorRepository.class);

    private VendorAuthService service(long cap) {
        return new VendorAuthService(
                vendorRepository,
                mock(RefreshTokenRepository.class),
                mock(PasswordEncoder.class),
                mock(JwtService.class),
                mock(AsyncEmailService.class),
                mock(VendorPromoService.class),
                "https://www.altarwed.com",
                "https://app.altarwed.com",
                cap);
    }

    @Test
    void spotsRemaining_underCap() {
        when(vendorRepository.countFoundingSlotsClaimed()).thenReturn(5L);
        assertThat(service(25).foundingSpots())
                .isEqualTo(new FoundingSpotsResponse(25, 20));
    }

    @Test
    void spotsRemaining_readsTheGateCounter_notCountVerified() {
        // A comped/paid vendor raises countVerified without consuming a founding
        // slot. The public number must follow the gate's counter, so the page
        // still shows 20 spots, not 15.
        when(vendorRepository.countFoundingSlotsClaimed()).thenReturn(5L);
        when(vendorRepository.countVerified()).thenReturn(10L);
        assertThat(service(25).foundingSpots())
                .isEqualTo(new FoundingSpotsResponse(25, 20));
        verify(vendorRepository, never()).countVerified();
    }

    @Test
    void spotsRemaining_clampsToZeroPastCap() {
        // An over-seeded counter must read "full", never a negative number.
        when(vendorRepository.countFoundingSlotsClaimed()).thenReturn(40L);
        assertThat(service(25).foundingSpots())
                .isEqualTo(new FoundingSpotsResponse(25, 0));
    }

    @Test
    void capZero_readsAsDisabledWithoutTouchingTheRepository() {
        assertThat(service(0).foundingSpots())
                .isEqualTo(new FoundingSpotsResponse(0, 0));
        verify(vendorRepository, never()).countFoundingSlotsClaimed();
    }
}
