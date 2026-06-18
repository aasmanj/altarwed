package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.EmailDelivery;
import com.altarwed.domain.model.EmailDeliveryStatus;
import com.altarwed.domain.port.EmailDeliveryRepository;
import com.altarwed.infrastructure.persistence.entity.EmailDeliveryEntity;
import com.altarwed.infrastructure.persistence.repository.EmailDeliveryJpaRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
public class EmailDeliveryRepositoryAdapter implements EmailDeliveryRepository {

    private final EmailDeliveryJpaRepository jpa;

    public EmailDeliveryRepositoryAdapter(EmailDeliveryJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public Optional<EmailDelivery> findByResendEmailId(String resendEmailId) {
        return jpa.findByResendEmailId(resendEmailId).map(this::toDomain);
    }

    @Override
    public EmailDelivery save(EmailDelivery delivery) {
        return toDomain(jpa.save(toEntity(delivery)));
    }

    @Override
    public List<EmailDelivery> findByCoupleId(UUID coupleId) {
        return jpa.findByCoupleId(coupleId).stream().map(this::toDomain).toList();
    }

    private EmailDelivery toDomain(EmailDeliveryEntity e) {
        return new EmailDelivery(
                e.getId(), e.getResendEmailId(), e.getGuestId(), e.getCoupleId(),
                e.getEmailType(), e.getRecipientEmailHash(),
                EmailDeliveryStatus.valueOf(e.getStatus()),
                e.getBounceType(), e.getBounceSubtype(),
                e.getLastEventAt(), e.getCreatedAt(), e.getUpdatedAt()
        );
    }

    private EmailDeliveryEntity toEntity(EmailDelivery d) {
        return EmailDeliveryEntity.builder()
                .id(d.id())
                .resendEmailId(d.resendEmailId())
                .guestId(d.guestId())
                .coupleId(d.coupleId())
                .emailType(d.emailType())
                .recipientEmailHash(d.recipientEmailHash())
                .status(d.status().name())
                .bounceType(d.bounceType())
                .bounceSubtype(d.bounceSubtype())
                .lastEventAt(d.lastEventAt())
                .createdAt(d.createdAt())
                .updatedAt(d.updatedAt())
                .build();
    }
}
