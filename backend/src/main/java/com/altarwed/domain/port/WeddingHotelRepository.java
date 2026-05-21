package com.altarwed.domain.port;

import com.altarwed.domain.model.WeddingHotel;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WeddingHotelRepository {
    List<WeddingHotel> findAllByWebsiteId(UUID websiteId);
    Optional<WeddingHotel> findById(UUID id);
    WeddingHotel save(WeddingHotel hotel);
    void deleteById(UUID id);
    boolean existsByIdAndWebsiteId(UUID id, UUID websiteId);
}
