package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.Inquiry;
import com.altarwed.domain.port.InquiryRepository;
import com.altarwed.infrastructure.persistence.entity.InquiryEntity;
import com.altarwed.infrastructure.persistence.repository.InquiryJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class InquiryRepositoryAdapter implements InquiryRepository {

    private final InquiryJpaRepository jpaRepository;

    @Override
    public Inquiry save(Inquiry inquiry) {
        return toDomain(jpaRepository.save(toEntity(inquiry)));
    }

    @Override
    public List<Inquiry> findByVendorId(UUID vendorId) {
        return jpaRepository.findByVendorIdOrderByCreatedAtDesc(vendorId)
                .stream().map(this::toDomain).toList();
    }

    @Override
    public long countByVendorId(UUID vendorId) {
        return jpaRepository.countByVendorId(vendorId);
    }

    @Override
    public long countUnreadByVendorId(UUID vendorId) {
        return jpaRepository.countByVendorIdAndIsReadFalse(vendorId);
    }

    @Override
    public boolean existsByIdAndVendorId(UUID inquiryId, UUID vendorId) {
        return jpaRepository.existsByIdAndVendorId(inquiryId, vendorId);
    }

    @Override
    public void markRead(UUID inquiryId) {
        jpaRepository.markReadById(inquiryId);
    }

    @Override
    public void deleteByVendorId(UUID vendorId) {
        jpaRepository.deleteByVendorId(vendorId);
    }

    // -------------------------------------------------------------------------
    // Mapping
    // -------------------------------------------------------------------------

    private Inquiry toDomain(InquiryEntity e) {
        return new Inquiry(
                e.getId(),
                e.getVendorId(),
                e.getCoupleName(),
                e.getCoupleEmail(),
                e.getWeddingDate(),
                e.getMessage(),
                e.isRead(),
                e.getCreatedAt()
        );
    }

    private InquiryEntity toEntity(Inquiry i) {
        return InquiryEntity.builder()
                .id(i.id())
                .vendorId(i.vendorId())
                .coupleName(i.coupleName())
                .coupleEmail(i.coupleEmail())
                .weddingDate(i.weddingDate())
                .message(i.message())
                .isRead(i.isRead())
                .createdAt(i.createdAt())
                .build();
    }
}
