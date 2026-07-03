package com.altarwed.application.service;

import com.altarwed.domain.port.CoupleEmailOptOutPort;
import com.altarwed.domain.port.EmailSuppressionPort;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Locks in the couple-aware suppression facade: a guest is suppressed for a couple when
 * EITHER a global deliverability fact applies OR they opted out of that couple's mail;
 * the badge reason prefers the global fact; resubscribe-on-RSVP clears the per-couple
 * opt-out (and a legacy global one) but never a bounce/complaint; and unsubscribe tokens
 * are bound to the couple so one couple's link can't be replayed against another.
 */
@ExtendWith(MockitoExtension.class)
class EmailSuppressionServiceTest {

    @Mock private EmailSuppressionPort suppressionPort;
    @Mock private CoupleEmailOptOutPort optOutPort;

    private EmailSuppressionService service() {
        return new EmailSuppressionService(suppressionPort, optOutPort, "test-secret");
    }

    private static final String HASH = "deadbeef";
    private static final UUID COUPLE = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @Test
    void isSuppressed_true_whenGloballySuppressed() {
        when(suppressionPort.isSuppressed(HASH)).thenReturn(true);
        assertThat(service().isSuppressed(COUPLE, HASH)).isTrue();
    }

    @Test
    void isSuppressed_true_whenOptedOutForThisCouple() {
        when(suppressionPort.isSuppressed(HASH)).thenReturn(false);
        when(optOutPort.isOptedOut(COUPLE, HASH)).thenReturn(true);
        assertThat(service().isSuppressed(COUPLE, HASH)).isTrue();
    }

    @Test
    void isSuppressed_false_whenNeitherGlobalNorCouple() {
        when(suppressionPort.isSuppressed(HASH)).thenReturn(false);
        when(optOutPort.isOptedOut(COUPLE, HASH)).thenReturn(false);
        assertThat(service().isSuppressed(COUPLE, HASH)).isFalse();
    }

    @Test
    void reasonFor_prefersGlobalSource_overPerCoupleOptOut() {
        // A global complaint outranks a per-couple opt-out for the same address.
        when(suppressionPort.suppressionSource(HASH)).thenReturn(Optional.of("COMPLAINT"));
        assertThat(service().reasonFor(COUPLE, HASH)).isEqualTo("COMPLAINT");
    }

    @Test
    void reasonFor_isUserRequest_whenOnlyPerCoupleOptOut() {
        when(suppressionPort.suppressionSource(HASH)).thenReturn(Optional.empty());
        when(optOutPort.isOptedOut(COUPLE, HASH)).thenReturn(true);
        assertThat(service().reasonFor(COUPLE, HASH)).isEqualTo("USER_REQUEST");
    }

    @Test
    void reasonsByHash_mergesGlobalAndCouple_globalWins() {
        when(suppressionPort.suppressionSources(Set.of("a", "b")))
                .thenReturn(Map.of("a", "BOUNCE"));
        when(optOutPort.optedOutHashes(COUPLE, Set.of("a", "b")))
                .thenReturn(Set.of("a", "b")); // a also opted out, but global BOUNCE wins
        Map<String, String> reasons = service().reasonsByHash(COUPLE, Set.of("a", "b"));
        assertThat(reasons).containsEntry("a", "BOUNCE").containsEntry("b", "USER_REQUEST");
    }

    @Test
    void resubscribeOnRsvp_clearsCoupleOptOut_andLegacyGlobal_butReturnsTrueIfEither() {
        when(optOutPort.removeOptOut(COUPLE, HASH)).thenReturn(true);
        when(suppressionPort.clearLegacyUserRequest(HASH)).thenReturn(false);
        assertThat(service().resubscribeOnRsvp(COUPLE, HASH)).isTrue();
    }

    @Test
    void resubscribeOnRsvp_returnsFalse_whenNothingWasCleared() {
        when(optOutPort.removeOptOut(COUPLE, HASH)).thenReturn(false);
        when(suppressionPort.clearLegacyUserRequest(HASH)).thenReturn(false);
        assertThat(service().resubscribeOnRsvp(COUPLE, HASH)).isFalse();
    }

    @Test
    void unsubscribeToken_isBoundToTheCouple_andRejectsAnotherCouple() {
        EmailSuppressionService svc = service();
        UUID otherCouple = UUID.fromString("22222222-2222-2222-2222-222222222222");
        String token = svc.generateToken(HASH, COUPLE);

        assertThat(svc.verifyToken(HASH, COUPLE, token)).isTrue();
        assertThat(svc.verifyToken(HASH, otherCouple, token)).isFalse();
        // A legacy hash-only token (no couple) is a different payload again.
        assertThat(svc.verifyToken(HASH, null, token)).isFalse();
    }

    @Test
    void legacyHashOnlyToken_roundTrips_whenCoupleIsNull() {
        EmailSuppressionService svc = service();
        String token = svc.generateToken(HASH, null);
        assertThat(svc.verifyToken(HASH, null, token)).isTrue();
    }

    // Documents behavior, not a regression guard: a literal empty-string secret makes
    // generateToken's SecretKeySpec throw ("Empty key" for a zero-length key array), which
    // verifyToken's existing IllegalArgumentException catch already turned into `false` even
    // before the #46 fix. This case would stay green even if the `configured` short-circuit
    // below were deleted -- verifyToken_rejectsEveryToken_whenSecretIsBlankButNotEmpty is the
    // test that actually regression-guards the fix.
    @Test
    void verifyToken_rejectsEveryToken_whenSecretIsEmpty() {
        EmailSuppressionService unconfigured = new EmailSuppressionService(suppressionPort, optOutPort, "");
        assertThat(unconfigured.verifyToken(HASH, COUPLE, "anything")).isFalse();
        assertThat(unconfigured.verifyToken(HASH, null, "anything")).isFalse();
    }

    // #46: the real regression guard. A non-empty but blank/whitespace secret signs
    // successfully (no crash), and pre-fix would have made every token forgeable by anyone who
    // could guess or brute-force a short whitespace-only key. Mints a real, matching token with
    // a second instance to prove the `configured` guard -- not a crash -- is what rejects it.
    @Test
    void verifyToken_rejectsEveryToken_whenSecretIsBlankButNotEmpty() {
        EmailSuppressionService unconfigured = new EmailSuppressionService(suppressionPort, optOutPort, "   ");
        String tokenSignedWithTheWeakKey = new EmailSuppressionService(suppressionPort, optOutPort, "   ")
                .generateToken(HASH, COUPLE);

        assertThat(unconfigured.verifyToken(HASH, COUPLE, tokenSignedWithTheWeakKey)).isFalse();
    }

    @Test
    void verifyToken_rejectsEveryToken_whenSecretIsNull() {
        EmailSuppressionService unconfigured = new EmailSuppressionService(suppressionPort, optOutPort, null);
        assertThat(unconfigured.verifyToken(HASH, COUPLE, "anything")).isFalse();
    }
}
