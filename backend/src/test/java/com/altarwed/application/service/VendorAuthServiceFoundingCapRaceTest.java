package com.altarwed.application.service;

import com.altarwed.application.dto.RegisterVendorRequest;
import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.model.VendorCategory;
import com.altarwed.domain.port.RefreshTokenRepository;
import com.altarwed.domain.port.VendorRepository;
import com.altarwed.infrastructure.security.JwtService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Issue #554 part 1: the founding-25 gate must not admit more than the cap under a concurrent
 * registration burst. The old gate was check-then-act (countVerified() &lt; cap, then grant), so two
 * registrations could both read the same pre-cap count and both be admitted. The fix collapses that
 * into a single atomic reservation, {@link VendorRepository#tryClaimFoundingSlot(long)}, which both
 * checks the cap and consumes the slot in one DB-serialized statement.
 *
 * These application-layer tests pin the SERVICE half of the fix: register() now derives founding
 * status ONLY from the atomic claim and never from a separate count read. The DB-atomicity half (the
 * conditional UPDATE actually serializing concurrent callers) is proven against a real SQL Server in
 * {@code FoundingCapRaceConcurrencyTest} (@Tag("schema-validation")), because a Mockito mock cannot
 * reproduce row-lock serialization. Splitting the proof this way keeps this suite deterministic and
 * Docker-free (it runs in the default ./gradlew test) while still failing if the check-then-act ever
 * returns.
 */
class VendorAuthServiceFoundingCapRaceTest {

    private static final long CAP = 25L;

    private final VendorRepository vendorRepository = mock(VendorRepository.class);
    private final RefreshTokenRepository refreshTokenRepository = mock(RefreshTokenRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final JwtService jwtService = mock(JwtService.class);
    private final AsyncEmailService asyncEmailService = mock(AsyncEmailService.class);
    private final VendorPromoService vendorPromoService = mock(VendorPromoService.class);

    private VendorAuthService service(long cap) {
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(jwtService.generateAccessToken(anyString(), anyString(), any())).thenReturn("access");
        when(jwtService.generateRefreshToken(anyString(), anyString(), any())).thenReturn("refresh");
        when(jwtService.hashToken(anyString())).thenReturn("refresh-hash");
        when(jwtService.getRefreshTokenExpiryMs()).thenReturn(3_600_000L);
        // Echo the saved vendor back with a generated id so register()'s post-save calls work.
        when(vendorRepository.save(any())).thenAnswer(inv -> withId(inv.getArgument(0)));
        return new VendorAuthService(
                vendorRepository, refreshTokenRepository, passwordEncoder, jwtService,
                asyncEmailService, vendorPromoService,
                "https://www.altarwed.com", "https://app.altarwed.com", cap);
    }

    private RegisterVendorRequest request(String email) {
        return new RegisterVendorRequest(
                "Grace Photography", VendorCategory.PHOTOGRAPHER, "Austin", "TX",
                email, "password123", true, List.of());
    }

    @Test
    void grantsFounding_onlyWhenTheAtomicClaimSucceeds() {
        VendorAuthService service = service(CAP);
        when(vendorRepository.existsByEmail(anyString())).thenReturn(false);
        when(vendorRepository.tryClaimFoundingSlot(CAP)).thenReturn(true);

        service.register(request("won@altarwed.test"));

        ArgumentCaptor<Vendor> saved = ArgumentCaptor.forClass(Vendor.class);
        verify(vendorRepository).save(saved.capture());
        assertThat(saved.getValue().isVerified())
                .as("a claimed founding slot auto-verifies the vendor at construction")
                .isTrue();
        verify(vendorPromoService).grantFoundingVendorAccess(any());
        verify(vendorRepository).tryClaimFoundingSlot(CAP);
    }

    @Test
    void deniesFounding_whenTheAtomicClaimFails_evenIfTheOldCountGateWouldHavePassed() {
        VendorAuthService service = service(CAP);
        when(vendorRepository.existsByEmail(anyString())).thenReturn(false);
        // The atomic reservation says the program is full...
        when(vendorRepository.tryClaimFoundingSlot(CAP)).thenReturn(false);
        // ...but the OLD check-then-act would still have granted founding here (0 < 25). If the
        // service regresses to reading countVerified(), this stub makes it grant founding and the
        // assertions below fail. That is the fails-before / passes-after guard.
        when(vendorRepository.countVerified()).thenReturn(0L);

        service.register(request("lost@altarwed.test"));

        ArgumentCaptor<Vendor> saved = ArgumentCaptor.forClass(Vendor.class);
        verify(vendorRepository).save(saved.capture());
        assertThat(saved.getValue().isVerified())
                .as("a denied founding slot must NOT auto-verify the vendor")
                .isFalse();
        verify(vendorPromoService, never()).grantFoundingVendorAccess(any());
        // The gate is the atomic claim, never a separate count read.
        verify(vendorRepository, never()).countVerified();
    }

    @Test
    void capZero_disablesTheProgram_withoutTouchingTheClaim() {
        VendorAuthService service = service(0L);
        when(vendorRepository.existsByEmail(anyString())).thenReturn(false);

        service.register(request("disabled@altarwed.test"));

        ArgumentCaptor<Vendor> saved = ArgumentCaptor.forClass(Vendor.class);
        verify(vendorRepository).save(saved.capture());
        assertThat(saved.getValue().isVerified()).isFalse();
        verify(vendorRepository, never()).tryClaimFoundingSlot(org.mockito.ArgumentMatchers.anyLong());
        verify(vendorPromoService, never()).grantFoundingVendorAccess(any());
    }

    /**
     * Deterministic interleaving around the service seam: back the claim with a real atomic counter
     * of cap 1 and run two sequential registrations. Exactly one is admitted as founding, proving the
     * service honours the cap the atomic primitive enforces. The concurrency proof (that the primitive
     * is itself race-safe) lives in the schema-validation test against real SQL Server.
     */
    @Test
    void twoRegistrations_shareACapOfOne_onlyOneWinsFounding() {
        VendorAuthService service = service(1L);
        when(vendorRepository.existsByEmail(anyString())).thenReturn(false);
        AtomicLong claimed = new AtomicLong(0);
        when(vendorRepository.tryClaimFoundingSlot(1L))
                .thenAnswer(inv -> claimed.getAndIncrement() < 1L);

        service.register(request("first@altarwed.test"));
        service.register(request("second@altarwed.test"));

        ArgumentCaptor<Vendor> saved = ArgumentCaptor.forClass(Vendor.class);
        verify(vendorRepository, org.mockito.Mockito.times(2)).save(saved.capture());
        List<Vendor> vendors = saved.getAllValues();
        assertThat(vendors.get(0).isVerified()).as("first registration wins the only founding slot").isTrue();
        assertThat(vendors.get(1).isVerified()).as("second registration is not founding").isFalse();
        verify(vendorPromoService, org.mockito.Mockito.times(1)).grantFoundingVendorAccess(any());
    }

    // Copy of the just-built domain Vendor with a generated id, mirroring what the JPA save returns.
    private static Vendor withId(Vendor v) {
        return new Vendor(
                UUID.randomUUID(), v.businessName(), v.category(), v.city(), v.state(), v.email(),
                v.passwordHash(), v.isChristianOwned(), v.denominationIds(), v.isActive(), v.isVerified(),
                v.priceTier(), v.bio(), v.description(), v.websiteUrl(), v.phone(), v.logoUrl(),
                v.viewCount(), v.contactEmail(), v.createdAt(), v.updatedAt());
    }
}
