package com.altarwed.domain.port;

import com.altarwed.domain.model.VendorSubscription;

import java.util.Optional;
import java.util.UUID;

public interface VendorSubscriptionRepository {
    VendorSubscription save(VendorSubscription subscription);
    Optional<VendorSubscription> findByVendorId(UUID vendorId);
    Optional<VendorSubscription> findByStripeSubscriptionId(String stripeSubscriptionId);
    Optional<VendorSubscription> findByStripeCustomerId(String stripeCustomerId);
}
