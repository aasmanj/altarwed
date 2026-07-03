package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.VendorSubscription;
import com.altarwed.domain.port.VendorSubscriptionRepository;
import com.altarwed.infrastructure.persistence.entity.VendorSubscriptionEntity;
import com.altarwed.infrastructure.persistence.repository.VendorSubscriptionJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class VendorSubscriptionRepositoryAdapter implements VendorSubscriptionRepository {

    private final VendorSubscriptionJpaRepository jpaRepository;

    @Override
    public VendorSubscription save(VendorSubscription sub) {
        return toDomain(jpaRepository.save(toEntity(sub)));
    }

    @Override
    public Optional<VendorSubscription> findByVendorId(UUID vendorId) {
        return jpaRepository.findByVendorId(vendorId).map(this::toDomain);
    }

    @Override
    public Optional<VendorSubscription> findByStripeSubscriptionId(String stripeSubscriptionId) {
        return jpaRepository.findByStripeSubscriptionId(stripeSubscriptionId).map(this::toDomain);
    }

    @Override
    public Optional<VendorSubscription> findByStripeCustomerId(String stripeCustomerId) {
        return jpaRepository.findByStripeCustomerId(stripeCustomerId).map(this::toDomain);
    }

    private VendorSubscription toDomain(VendorSubscriptionEntity e) {
        return new VendorSubscription(
                e.getId(),
                e.getVendorId(),
                e.getPlanTier(),
                e.getStatus(),
                e.getStripeCustomerId(),
                e.getStripeSubscriptionId(),
                e.getCurrentPeriodStart(),
                e.getCurrentPeriodEnd(),
                e.getCancelledAt(),
                e.getCreatedAt(),
                e.getUpdatedAt(),
                e.getLastStripeEventAt()
        );
    }

    private VendorSubscriptionEntity toEntity(VendorSubscription sub) {
        return VendorSubscriptionEntity.builder()
                .id(sub.id())
                .vendorId(sub.vendorId())
                .planTier(sub.planTier())
                .status(sub.status())
                .stripeCustomerId(sub.stripeCustomerId())
                .stripeSubscriptionId(sub.stripeSubscriptionId())
                .currentPeriodStart(sub.currentPeriodStart())
                .currentPeriodEnd(sub.currentPeriodEnd())
                .cancelledAt(sub.cancelledAt())
                .createdAt(sub.createdAt())
                .updatedAt(sub.updatedAt())
                .lastStripeEventAt(sub.lastStripeEventAt())
                .build();
    }
}
