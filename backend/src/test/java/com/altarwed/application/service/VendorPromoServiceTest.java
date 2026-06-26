package com.altarwed.application.service;

import com.altarwed.domain.exception.InvalidPromoCodeException;
import com.altarwed.domain.model.PlanTier;
import com.altarwed.domain.model.SubscriptionStatus;
import com.altarwed.domain.model.VendorSubscription;
import com.altarwed.domain.port.VendorSubscriptionRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
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
    private final VendorService vendorService = mock(VendorService.class);
    private final UUID vendorId = UUID.randomUUID();

    private VendorPromoService service(String configuredCode) {
        return new VendorPromoService(subscriptionRepository, vendorService, configuredCode);
    }

    @Test
    void valid_code_grants_a_comped_active_subscription_and_verifies_the_vendor() {
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
    }

    @Test
    void invalid_code_is_rejected_and_nothing_is_granted() {
        when(subscriptionRepository.findByVendorId(vendorId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service("FREEVENDOR").redeem(vendorId, "WRONGCODE"))
                .isInstanceOf(InvalidPromoCodeException.class);

        verify(subscriptionRepository, never()).save(any());
        verify(vendorService, never()).verify(any());
    }

    @Test
    void redemption_is_disabled_when_no_code_is_configured() {
        assertThatThrownBy(() -> service("").redeem(vendorId, "FREEVENDOR"))
                .isInstanceOf(InvalidPromoCodeException.class);
        assertThatThrownBy(() -> service("   ").redeem(vendorId, "FREEVENDOR"))
                .isInstanceOf(InvalidPromoCodeException.class);
        verify(subscriptionRepository, never()).save(any());
        verify(vendorService, never()).verify(any());
    }

    @Test
    void a_stripe_backed_subscription_is_never_overwritten_by_a_comp() {
        LocalDateTime now = LocalDateTime.now();
        // PAST_DUE (not ACTIVE): the failed-payment vendor still carries their stripe ids, and
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
}
