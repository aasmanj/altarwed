package com.altarwed.domain.port;

import com.altarwed.domain.model.Inquiry;

import java.util.List;
import java.util.UUID;

public interface InquiryRepository {

    Inquiry save(Inquiry inquiry);

    List<Inquiry> findByVendorId(UUID vendorId);

    long countUnreadByVendorId(UUID vendorId);

    boolean existsByIdAndVendorId(UUID inquiryId, UUID vendorId);

    void markRead(UUID inquiryId);
}
