package com.altarwed.web.mapper;

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
                vendor.email(),
                vendor.isChristianOwned(),
                vendor.denominationIds(),
                vendor.isVerified()
        );
    }
}
