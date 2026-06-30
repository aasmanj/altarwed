package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.VendorPromoCode;
import com.altarwed.domain.model.VendorPromoRedemption;
import com.altarwed.domain.port.VendorPromoCodeRepository;
import com.altarwed.infrastructure.persistence.entity.VendorPromoCodeEntity;
import com.altarwed.infrastructure.persistence.entity.VendorPromoRedemptionEntity;
import com.altarwed.infrastructure.persistence.repository.VendorPromoCodeJpaRepository;
import com.altarwed.infrastructure.persistence.repository.VendorPromoRedemptionJpaRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class VendorPromoCodeRepositoryAdapter implements VendorPromoCodeRepository {

    private final VendorPromoCodeJpaRepository codeRepository;
    private final VendorPromoRedemptionJpaRepository redemptionRepository;

    public VendorPromoCodeRepositoryAdapter(
            VendorPromoCodeJpaRepository codeRepository,
            VendorPromoRedemptionJpaRepository redemptionRepository
    ) {
        this.codeRepository = codeRepository;
        this.redemptionRepository = redemptionRepository;
    }

    @Override
    public long count() {
        return codeRepository.count();
    }

    @Override
    public Optional<VendorPromoCode> findByCodeIgnoreCase(String code) {
        return codeRepository.findByCodeIgnoreCase(code).map(this::toDomain);
    }

    @Override
    public List<VendorPromoCode> findAll() {
        return codeRepository.findAll().stream().map(this::toDomain).toList();
    }

    @Override
    public VendorPromoCode save(VendorPromoCode code) {
        return toDomain(codeRepository.save(toEntity(code)));
    }

    @Override
    public VendorPromoRedemption saveRedemption(VendorPromoRedemption redemption) {
        // saveAndFlush (not save): force the INSERT to hit the DB now so the
        // UNIQUE(code_id, vendor_id) constraint (V76) fires synchronously as a
        // DataIntegrityViolationException the service can catch, rather than at transaction commit
        // (after the service method returns) where it would escape as an unhandled 500.
        return toDomain(redemptionRepository.saveAndFlush(toEntity(redemption)));
    }

    private VendorPromoCode toDomain(VendorPromoCodeEntity e) {
        return new VendorPromoCode(
                e.getId(),
                e.getCode(),
                e.getMaxRedemptions(),
                e.getExpiresAt(),
                e.getRedeemedCount(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }

    private VendorPromoCodeEntity toEntity(VendorPromoCode c) {
        VendorPromoCodeEntity e = new VendorPromoCodeEntity();
        e.setId(c.id());
        e.setCode(c.code());
        e.setMaxRedemptions(c.maxRedemptions());
        e.setExpiresAt(c.expiresAt());
        e.setRedeemedCount(c.redeemedCount());
        e.setCreatedAt(c.createdAt());
        e.setUpdatedAt(c.updatedAt());
        return e;
    }

    private VendorPromoRedemption toDomain(VendorPromoRedemptionEntity e) {
        return new VendorPromoRedemption(
                e.getId(),
                e.getCodeId(),
                e.getVendorId(),
                e.getRedeemedAt()
        );
    }

    private VendorPromoRedemptionEntity toEntity(VendorPromoRedemption r) {
        VendorPromoRedemptionEntity e = new VendorPromoRedemptionEntity();
        e.setId(r.id());
        e.setCodeId(r.codeId());
        e.setVendorId(r.vendorId());
        e.setRedeemedAt(r.redeemedAt());
        return e;
    }
}
