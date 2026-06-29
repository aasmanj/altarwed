package com.altarwed.application.service;

import com.altarwed.domain.exception.InvalidPromoCodeException;
import com.altarwed.domain.model.PlanTier;
import com.altarwed.domain.model.SubscriptionStatus;
import com.altarwed.domain.model.VendorPromoCode;
import com.altarwed.domain.model.VendorPromoRedemption;
import com.altarwed.domain.model.VendorSubscription;
import com.altarwed.domain.port.VendorPromoCodeRepository;
import com.altarwed.domain.port.VendorSubscriptionRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class VendorPromoServiceTest {

    private final VendorSubscriptionRepository subscriptionRepository = mock(VendorSubscriptionRepository.class);
    private final VendorPromoCodeRepository promoCodeRepository = mock(VendorPromoCodeRepository.class);
    private final VendorService vendorService = mock(VendorService.class);
    private final UUID vendorId = UUID.randomUUID();

    private VendorPromoService service(String configuredCode) {
        return new VendorPromoService(subscriptionRepository, promoCodeRepository, vendorService, configuredCode);
    }

    private VendorPromoCode dbCode(Integer maxRedemptions, OffsetDateTime expiresAt, Integer redeemedCount) {
        OffsetDateTime now = OffsetDateTime.now();
        return new VendorPromoCode(UUID.randomUUID(), "LAUNCH50", maxRedemptions, expiresAt, redeemedCount, now, now);
    }

    // -------------------------------------------------------------------------
    // Env-var fallback (vendor_promo_codes empty) -- backward compatibility
    // -------------------------------------------------------------------------

    @Test
    void valid_env_code_grants_a_comped_active_subscription_when_db_table_is_empty() {
        when(promoCodeRepository.count()).thenReturn(0L);
        when(subscriptionRepository.findByVendorId(vendorId)).thenReturn(Optional.empty());
        when(subscriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Code match is case-insensitive and trimmed.
        VendorSubscription result = service("FREEVENDOR").redeem(vendorId, "  freevendor ");

        ArgumentCaptor<VendorSubscription> captor = ArgumentCaptor.forClass(VendorSubscription.class);
        verify(subscriptionRepository).save(captor.capture());
        VendorSubscription saved = captor.getValue();
        assertThat(saved.status()).isEqualTo(SubscriptionStatus.ACTIVE);
        assertThat(saved.planTier()).isEqualTo(PlanTier.FEATURED);
        // The null Stripe ids are the "comped" marker that distinguishes this from a paying sub.
        assertThat(saved.stripeCustomerId()).isNull();
        assertThat(saved.stripeSubscriptionId()).isNull();
        assertThat(saved.currentPeriodEnd()).isNull();
        assertThat(saved.vendorId()).isEqualTo(vendorId);
        assertThat(result).isNotNull();
        // Same publish path the Stripe webhook uses.
        verify(vendorService).verify(vendorId);
        // No DB code existed, so nothing is consumed.
        verify(promoCodeRepository, never()).saveRedemption(any());
    }

    @Test
    void invalid_env_code_is_rejected_and_nothing_is_granted() {
        when(promoCodeRepository.count()).thenReturn(0L);

        assertThatThrownBy(() -> service("FREEVENDOR").redeem(vendorId, "WRONGCODE"))
                .isInstanceOf(InvalidPromoCodeException.class);

        verify(subscriptionRepository, never()).save(any());
        verify(vendorService, never()).verify(any());
    }

    @Test
    void redemption_is_disabled_when_no_code_is_configured_and_db_is_empty() {
        when(promoCodeRepository.count()).thenReturn(0L);

        assertThatThrownBy(() -> service("").redeem(vendorId, "FREEVENDOR"))
                .isInstanceOf(InvalidPromoCodeException.class);
        assertThatThrownBy(() -> service("   ").redeem(vendorId, "FREEVENDOR"))
                .isInstanceOf(InvalidPromoCodeException.class);
        verify(subscriptionRepository, never()).save(any());
        verify(vendorService, never()).verify(any());
    }

    // -------------------------------------------------------------------------
    // DB-backed codes (vendor_promo_codes non-empty)
    // -------------------------------------------------------------------------

    @Test
    void valid_db_code_increments_count_and_inserts_an_audit_row() {
        VendorPromoCode code = dbCode(10, null, 3);
        when(promoCodeRepository.count()).thenReturn(1L);
        when(promoCodeRepository.findByCodeIgnoreCase("LAUNCH50")).thenReturn(Optional.of(code));
        when(subscriptionRepository.findByVendorId(vendorId)).thenReturn(Optional.empty());
        when(subscriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // The mock matches literally, so submit the same casing the service forwards to the
        // (case-insensitive in production) lookup.
        service("FREEVENDOR").redeem(vendorId, "LAUNCH50");

        ArgumentCaptor<VendorPromoCode> codeCaptor = ArgumentCaptor.forClass(VendorPromoCode.class);
        verify(promoCodeRepository).save(codeCaptor.capture());
        // redeemed_count incremented by exactly one.
        assertThat(codeCaptor.getValue().redeemedCount()).isEqualTo(4);

        ArgumentCaptor<VendorPromoRedemption> auditCaptor = ArgumentCaptor.forClass(VendorPromoRedemption.class);
        verify(promoCodeRepository).saveRedemption(auditCaptor.capture());
        assertThat(auditCaptor.getValue().codeId()).isEqualTo(code.id());
        assertThat(auditCaptor.getValue().vendorId()).isEqualTo(vendorId);

        verify(vendorService).verify(vendorId);
    }

    @Test
    void over_cap_db_code_is_rejected_and_nothing_is_granted() {
        VendorPromoCode code = dbCode(5, null, 5); // redeemedCount == maxRedemptions
        when(promoCodeRepository.count()).thenReturn(1L);
        when(promoCodeRepository.findByCodeIgnoreCase("LAUNCH50")).thenReturn(Optional.of(code));

        assertThatThrownBy(() -> service("FREEVENDOR").redeem(vendorId, "LAUNCH50"))
                .isInstanceOf(InvalidPromoCodeException.class);

        verify(subscriptionRepository, never()).save(any());
        verify(promoCodeRepository, never()).saveRedemption(any());
        verify(vendorService, never()).verify(any());
    }

    @Test
    void expired_db_code_is_rejected_and_nothing_is_granted() {
        VendorPromoCode code = dbCode(null, OffsetDateTime.now().minusDays(1), 0);
        when(promoCodeRepository.count()).thenReturn(1L);
        when(promoCodeRepository.findByCodeIgnoreCase("LAUNCH50")).thenReturn(Optional.of(code));

        assertThatThrownBy(() -> service("FREEVENDOR").redeem(vendorId, "LAUNCH50"))
                .isInstanceOf(InvalidPromoCodeException.class);

        verify(subscriptionRepository, never()).save(any());
        verify(promoCodeRepository, never()).saveRedemption(any());
        verify(vendorService, never()).verify(any());
    }

    @Test
    void unknown_db_code_is_rejected_and_env_fallback_is_not_consulted() {
        when(promoCodeRepository.count()).thenReturn(1L);
        when(promoCodeRepository.findByCodeIgnoreCase("FREEVENDOR")).thenReturn(Optional.empty());

        // Even though FREEVENDOR is the configured env code, the DB table is non-empty so the env
        // fallback must NOT apply: the only valid codes are the DB rows.
        assertThatThrownBy(() -> service("FREEVENDOR").redeem(vendorId, "FREEVENDOR"))
                .isInstanceOf(InvalidPromoCodeException.class);

        verify(subscriptionRepository, never()).save(any());
        verify(vendorService, never()).verify(any());
    }

    @Test
    void double_redemption_by_the_same_vendor_is_translated_to_an_invalid_code_rejection() {
        // The vendor passes every in-memory check (valid, under cap, not expired) but the
        // append-only INSERT trips the DB UNIQUE(code_id, vendor_id) constraint (V76) because this
        // vendor already redeemed this code. The service must catch the raw DataIntegrityViolation
        // and re-throw the domain InvalidPromoCodeException (a clean 400), never leak a 500.
        VendorPromoCode code = dbCode(10, null, 3);
        when(promoCodeRepository.count()).thenReturn(1L);
        when(promoCodeRepository.findByCodeIgnoreCase("LAUNCH50")).thenReturn(Optional.of(code));
        when(subscriptionRepository.findByVendorId(vendorId)).thenReturn(Optional.empty());
        when(subscriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(promoCodeRepository.saveRedemption(any()))
                .thenThrow(new DataIntegrityViolationException("uq_vendor_promo_redemptions_code_vendor"));

        assertThatThrownBy(() -> service("FREEVENDOR").redeem(vendorId, "LAUNCH50"))
                .isInstanceOf(InvalidPromoCodeException.class)
                .hasMessageContaining("already redeemed");

        // The audit insert was attempted (that is what trips the constraint).
        verify(promoCodeRepository).saveRedemption(any());
    }

    // -------------------------------------------------------------------------
    // Stripe-vs-comp interaction
    // -------------------------------------------------------------------------

    @Test
    void a_live_stripe_backed_subscription_is_never_overwritten_by_a_comp() {
        when(promoCodeRepository.count()).thenReturn(0L);
        LocalDateTime now = LocalDateTime.now();
        // PAST_DUE (not CANCELLED): the failed-payment vendor still carries their stripe ids, and
        // nulling them here would desync the Stripe webhooks, so the comp must leave them alone.
        VendorSubscription stripeBacked = new VendorSubscription(
                UUID.randomUUID(), vendorId, PlanTier.FEATURED, SubscriptionStatus.PAST_DUE,
                "cus_123", "sub_123", now, now.plusMonths(1), null, now, now
        );
        when(subscriptionRepository.findByVendorId(vendorId)).thenReturn(Optional.of(stripeBacked));

        VendorSubscription result = service("FREEVENDOR").redeem(vendorId, "FREEVENDOR");

        // Must not clobber their billing linkage; just ensure they stay listed.
        verify(subscriptionRepository, never()).save(any());
        verify(vendorService).verify(vendorId);
        assertThat(result.stripeSubscriptionId()).isEqualTo("sub_123");
    }

    @Test
    void a_cancelled_stripe_vendor_who_redeems_becomes_an_active_comp() {
        when(promoCodeRepository.count()).thenReturn(0L);
        LocalDateTime now = LocalDateTime.now();
        // CANCELLED Stripe sub: subscription.deleted already fired, so the comp is allowed to take
        // it over and re-list the vendor. The result must read as "comped" (ACTIVE, null stripe id),
        // not fall through to the Upgrade panel.
        VendorSubscription cancelled = new VendorSubscription(
                UUID.randomUUID(), vendorId, PlanTier.FEATURED, SubscriptionStatus.CANCELLED,
                "cus_123", "sub_123", now, now.plusMonths(1), now, now, now
        );
        when(subscriptionRepository.findByVendorId(vendorId)).thenReturn(Optional.of(cancelled));
        when(subscriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        VendorSubscription result = service("FREEVENDOR").redeem(vendorId, "FREEVENDOR");

        ArgumentCaptor<VendorSubscription> captor = ArgumentCaptor.forClass(VendorSubscription.class);
        verify(subscriptionRepository).save(captor.capture());
        VendorSubscription saved = captor.getValue();
        assertThat(saved.status()).isEqualTo(SubscriptionStatus.ACTIVE);
        assertThat(saved.stripeSubscriptionId()).isNull();
        assertThat(saved.stripeCustomerId()).isNull();
        // Preserves the existing row id (overwrite, not a duplicate insert).
        assertThat(saved.id()).isEqualTo(cancelled.id());
        assertThat(result.stripeSubscriptionId()).isNull();
        verify(vendorService).verify(vendorId);
    }

    // -------------------------------------------------------------------------
    // Admin issuance
    // -------------------------------------------------------------------------

    @Test
    void creating_a_code_rejects_a_duplicate_value() {
        when(promoCodeRepository.findByCodeIgnoreCase("LAUNCH50"))
                .thenReturn(Optional.of(dbCode(10, null, 0)));

        assertThatThrownBy(() -> service("FREEVENDOR").createPromoCode("LAUNCH50", 10, null))
                .isInstanceOf(InvalidPromoCodeException.class);

        verify(promoCodeRepository, never()).save(any());
    }

    @Test
    void creating_a_code_persists_a_zeroed_trimmed_code() {
        when(promoCodeRepository.findByCodeIgnoreCase("LAUNCH50")).thenReturn(Optional.empty());
        when(promoCodeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service("FREEVENDOR").createPromoCode("  LAUNCH50 ", 25, null);

        ArgumentCaptor<VendorPromoCode> captor = ArgumentCaptor.forClass(VendorPromoCode.class);
        verify(promoCodeRepository).save(captor.capture());
        assertThat(captor.getValue().code()).isEqualTo("LAUNCH50");
        assertThat(captor.getValue().redeemedCount()).isEqualTo(0);
        assertThat(captor.getValue().maxRedemptions()).isEqualTo(25);
    }
}
