package com.altarwed.application.service;

import com.altarwed.application.dto.SubmitPrayerRequest;
import com.altarwed.domain.exception.WeddingPrayerNotFoundException;
import com.altarwed.domain.exception.WeddingWebsiteNotFoundException;
import com.altarwed.domain.model.WeddingPrayer;
import com.altarwed.domain.port.WeddingPrayerRepository;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class WeddingPrayerService {

    private final WeddingPrayerRepository prayerRepository;
    private final WeddingWebsiteRepository websiteRepository;

    public WeddingPrayerService(WeddingPrayerRepository prayerRepository, WeddingWebsiteRepository websiteRepository) {
        this.prayerRepository = prayerRepository;
        this.websiteRepository = websiteRepository;
    }

    // Public — called from the Next.js wedding page, no auth required
    @Transactional
    public WeddingPrayer submitPrayer(String slug, SubmitPrayerRequest req) {
        var website = websiteRepository.findBySlug(slug)
                .orElseThrow(() -> new WeddingWebsiteNotFoundException(slug));
        WeddingPrayer prayer = new WeddingPrayer(
                null, website.id(), req.guestName(), req.prayerText(), LocalDateTime.now()
        );
        return prayerRepository.save(prayer);
    }

    // Public — called from the Next.js wedding page, no auth required
    @Transactional(readOnly = true)
    public List<WeddingPrayer> listPrayers(String slug) {
        var website = websiteRepository.findBySlug(slug)
                .orElseThrow(() -> new WeddingWebsiteNotFoundException(slug));
        return prayerRepository.findAllByWeddingWebsiteId(website.id());
    }

    // Authenticated — couple deletes an inappropriate prayer from their dashboard
    @Transactional
    public void deletePrayer(UUID websiteId, UUID prayerId) {
        if (!prayerRepository.existsByIdAndWeddingWebsiteId(prayerId, websiteId)) {
            throw new WeddingPrayerNotFoundException(prayerId.toString());
        }
        prayerRepository.deleteById(prayerId);
    }
}
