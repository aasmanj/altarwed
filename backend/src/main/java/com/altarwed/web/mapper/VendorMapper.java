package com.altarwed.web.mapper;

import com.altarwed.application.dto.VendorProfileResponse;
import com.altarwed.application.dto.VendorResponse;
import com.altarwed.domain.model.Vendor;
import org.springframework.stereotype.Component;

@Component
public class VendorMapper {

    public VendorResponse toResponse(Vendor vendor) {
        return new VendorResponse(
                vendor.id(),
                vendor.businessName(),
                vendor.category(),
                vendor.city(),
                vendor.state(),
                vendor.isChristianOwned(),
                vendor.denominationIds(),
                vendor.isVerified(),
                vendor.priceTier(),
                vendor.bio(),
                vendor.description(),
                vendor.websiteUrl(),
                vendor.phone(),
                vendor.logoUrl(),
                vendor.contactEmail()
        );
    }

    public VendorProfileResponse toProfileResponse(Vendor vendor) {
        return new VendorProfileResponse(
                vendor.id(),
                vendor.email(),
                vendor.businessName(),
                vendor.category(),
                vendor.city(),
                vendor.state(),
                vendor.isChristianOwned(),
                vendor.denominationIds(),
                vendor.isVerified(),
                vendor.priceTier(),
                vendor.bio(),
                vendor.description(),
                vendor.websiteUrl(),
                vendor.phone(),
                vendor.logoUrl(),
                vendor.contactEmail()
        );
    }
}
