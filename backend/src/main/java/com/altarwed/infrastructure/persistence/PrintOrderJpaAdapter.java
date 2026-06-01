package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.PrintOrder;
import com.altarwed.domain.model.PrintOrderRecipient;
import com.altarwed.domain.model.PrintOrderStatus;
import com.altarwed.domain.model.PrintOrderType;
import com.altarwed.domain.port.PrintOrderRepository;
import com.altarwed.infrastructure.persistence.entity.PrintOrderEntity;
import com.altarwed.infrastructure.persistence.entity.PrintOrderRecipientEntity;
import com.altarwed.infrastructure.persistence.repository.PrintOrderJpaRepository;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class PrintOrderJpaAdapter implements PrintOrderRepository {

    private final PrintOrderJpaRepository jpa;

    public PrintOrderJpaAdapter(PrintOrderJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public PrintOrder save(PrintOrder order) {
        PrintOrderEntity entity = toEntity(order);
        return toDomain(jpa.save(entity));
    }

    @Override
    public Optional<PrintOrder> findById(UUID id) {
        return jpa.findById(id).map(this::toDomain);
    }

    @Override
    public List<PrintOrder> findAllByCoupleId(UUID coupleId) {
        return jpa.findAllByCoupleIdOrderByCreatedAtDesc(coupleId).stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<PrintOrder> findByCoupleIdAndIdempotencyKey(UUID coupleId, String idempotencyKey) {
        return jpa.findByCoupleIdAndIdempotencyKey(coupleId, idempotencyKey).map(this::toDomain);
    }

    private PrintOrderEntity toEntity(PrintOrder o) {
        PrintOrderEntity e = PrintOrderEntity.builder()
                .id(o.id())
                .coupleId(o.coupleId())
                .idempotencyKey(o.idempotencyKey())
                .orderType(o.orderType().name())
                .status(o.status().name())
                .templateKey(o.templateKey())
                .recipientCount(o.recipientCount())
                .costCents(o.costCents())
                .errorMessage(o.errorMessage())
                .createdAt(o.createdAt())
                .submittedAt(o.submittedAt())
                .build();
        if (o.recipients() != null) {
            // Must be a MUTABLE list: Hibernate manages this @OneToMany collection
            // (orphanRemoval + merge on the final update) and cannot mutate an
            // immutable Stream.toList() result, it throws UnsupportedOperationException.
            e.setRecipients(new ArrayList<>(
                    o.recipients().stream().map(this::toRecipientEntity).toList()));
        }
        return e;
    }

    private PrintOrderRecipientEntity toRecipientEntity(PrintOrderRecipient r) {
        return PrintOrderRecipientEntity.builder()
                .id(r.id())
                .guestId(r.guestId())
                .lobPostcardId(r.lobPostcardId())
                .deliveryStatus(r.deliveryStatus())
                .errorMessage(r.errorMessage())
                .build();
    }

    private PrintOrder toDomain(PrintOrderEntity e) {
        return new PrintOrder(
                e.getId(),
                e.getCoupleId(),
                PrintOrderType.valueOf(e.getOrderType()),
                PrintOrderStatus.valueOf(e.getStatus()),
                e.getTemplateKey(),
                e.getRecipientCount(),
                e.getCostCents(),
                e.getErrorMessage(),
                e.getCreatedAt(),
                e.getSubmittedAt(),
                e.getRecipients().stream().map(this::toRecipientDomain).toList(),
                e.getIdempotencyKey()
        );
    }

    private PrintOrderRecipient toRecipientDomain(PrintOrderRecipientEntity r) {
        return new PrintOrderRecipient(
                r.getId(),
                r.getPrintOrderId(),
                r.getGuestId(),
                r.getLobPostcardId(),
                r.getDeliveryStatus(),
                r.getErrorMessage()
        );
    }
}
