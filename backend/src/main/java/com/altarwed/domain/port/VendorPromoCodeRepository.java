package com.altarwed.domain.port;

import com.altarwed.domain.model.VendorPromoCode;
import com.altarwed.domain.model.VendorPromoRedemption;

import java.util.List;
import java.util.Optional;

/**
 * Domain port for DB-backed vendor comp promo codes and their redemption audit trail. Implemented
 * by a JPA adapter in infrastructure. Kept free of any Spring/JPA types so the domain stays pure.
 */
public interface VendorPromoCodeRepository {

    /** Total issued codes. Zero means "fall back to the legacy env-var code" in VendorPromoService. */
    long count();

    /** Case-insensitive lookup, since codes are matched without regard to the caller's casing. */
    Optional<VendorPromoCode> findByCodeIgnoreCase(String code);

    List<VendorPromoCode> findAll();

    VendorPromoCode save(VendorPromoCode code);

    VendorPromoRedemption saveRedemption(VendorPromoRedemption redemption);
}
