package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.VendorSubscriptionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface VendorSubscriptionJpaRepository extends JpaRepository<VendorSubscriptionEntity, UUID> {
    Optional<VendorSubscriptionEntity> findByVendorId(UUID vendorId);
    Optional<VendorSubscriptionEntity> findByStripeSubscriptionId(String stripeSubscriptionId);
    Optional<VendorSubscriptionEntity> findByStripeCustomerId(String stripeCustomerId);
}
