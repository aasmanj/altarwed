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
 * Unit tests for the public founding-spots counter. It must mirror the registration
 * gate's countVerified-vs-cap comparison exactly (same repository count, same cap),
 * clamp at zero once paid vendors push the verified count past the cap, and read as
 * a disabled program when the cap is configured to 0.
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
        when(vendorRepository.countVerified()).thenReturn(5L);
        assertThat(service(25).foundingSpots())
                .isEqualTo(new FoundingSpotsResponse(25, 20));
    }

    @Test
    void spotsRemaining_clampsToZeroPastCap() {
        // Paid vendors keep growing countVerified after the founding window closes;
        // the public counter must read "full", never a negative number.
        when(vendorRepository.countVerified()).thenReturn(40L);
        assertThat(service(25).foundingSpots())
                .isEqualTo(new FoundingSpotsResponse(25, 0));
    }

    @Test
    void capZero_readsAsDisabledWithoutTouchingTheRepository() {
        assertThat(service(0).foundingSpots())
                .isEqualTo(new FoundingSpotsResponse(0, 0));
        verify(vendorRepository, never()).countVerified();
    }
}
