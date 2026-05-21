package com.altarwed.application.service;

import com.altarwed.application.dto.WeddingHotelRequest;
import com.altarwed.domain.exception.WeddingHotelNotFoundException;
import com.altarwed.domain.model.WeddingHotel;
import com.altarwed.domain.port.WeddingHotelRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class WeddingHotelService {

    private final WeddingHotelRepository hotelRepository;

    public WeddingHotelService(WeddingHotelRepository hotelRepository) {
        this.hotelRepository = hotelRepository;
    }

    @Transactional(readOnly = true)
    public List<WeddingHotel> listByWebsite(UUID websiteId) {
        return hotelRepository.findAllByWebsiteId(websiteId);
    }

    @Transactional
    public WeddingHotel addHotel(UUID websiteId, WeddingHotelRequest req) {
        int nextOrder = hotelRepository.findAllByWebsiteId(websiteId).size();
        WeddingHotel hotel = new WeddingHotel(
                null, websiteId, req.name(), req.address(),
                req.bookingUrl(), req.blockRate(), req.distanceFromVenue(),
                req.sortOrder() != null ? req.sortOrder() : nextOrder,
                LocalDateTime.now(), LocalDateTime.now()
        );
        return hotelRepository.save(hotel);
    }

    @Transactional
    public WeddingHotel updateHotel(UUID websiteId, UUID hotelId, WeddingHotelRequest req) {
        WeddingHotel existing = getHotel(websiteId, hotelId);
        WeddingHotel updated = new WeddingHotel(
                existing.id(), existing.websiteId(),
                req.name()                != null ? req.name()                : existing.name(),
                req.address()             != null ? req.address()             : existing.address(),
                req.bookingUrl()          != null ? req.bookingUrl()          : existing.bookingUrl(),
                req.blockRate()           != null ? req.blockRate()           : existing.blockRate(),
                req.distanceFromVenue()   != null ? req.distanceFromVenue()   : existing.distanceFromVenue(),
                req.sortOrder()           != null ? req.sortOrder()           : existing.sortOrder(),
                existing.createdAt(), LocalDateTime.now()
        );
        return hotelRepository.save(updated);
    }

    @Transactional
    public void deleteHotel(UUID websiteId, UUID hotelId) {
        if (!hotelRepository.existsByIdAndWebsiteId(hotelId, websiteId)) {
            throw new WeddingHotelNotFoundException(hotelId.toString());
        }
        hotelRepository.deleteById(hotelId);
    }

    private WeddingHotel getHotel(UUID websiteId, UUID hotelId) {
        WeddingHotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new WeddingHotelNotFoundException(hotelId.toString()));
        if (!hotel.websiteId().equals(websiteId)) {
            throw new WeddingHotelNotFoundException(hotelId.toString());
        }
        return hotel;
    }
}
