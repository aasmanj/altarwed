package com.altarwed.application.service;

import com.altarwed.application.dto.CreateWeddingWebsiteRequest;
import com.altarwed.application.dto.UpdateWeddingWebsiteRequest;
import com.altarwed.domain.exception.SlugAlreadyTakenException;
import com.altarwed.domain.exception.WeddingWebsiteAlreadyExistsException;
import com.altarwed.domain.exception.WeddingWebsiteNotFoundException;
import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.domain.port.RevalidationPort;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class WeddingWebsiteService {

    private final WeddingWebsiteRepository websiteRepository;
    private final RevalidationPort revalidationPort;

    public WeddingWebsiteService(
            WeddingWebsiteRepository websiteRepository,
            RevalidationPort revalidationPort
    ) {
        this.websiteRepository = websiteRepository;
        this.revalidationPort = revalidationPort;
    }

    @Transactional
    public WeddingWebsite create(UUID coupleId, CreateWeddingWebsiteRequest request) {
        if (websiteRepository.existsByCoupleId(coupleId)) {
            throw new WeddingWebsiteAlreadyExistsException(coupleId);
        }
        String slug = request.slug().toLowerCase();
        if (websiteRepository.existsBySlug(slug)) {
            throw new SlugAlreadyTakenException(slug);
        }

        WeddingWebsite website = new WeddingWebsite(
                null, coupleId, slug, false,
                request.partnerOneName(), request.partnerTwoName(), request.weddingDate(),
                null, null, null, null, null, null,
                null, null, null, null, null, null,
                null, null, null,
                null, null, null, null, null, null,
                null,
                false, null,
                LocalDateTime.now(), LocalDateTime.now()
        );
        return websiteRepository.save(website);
    }

    @Transactional(readOnly = true)
    public WeddingWebsite getByCoupleId(UUID coupleId) {
        return websiteRepository.findByCoupleId(coupleId)
                .orElseThrow(() -> new WeddingWebsiteNotFoundException("couple:" + coupleId));
    }

    @Transactional(readOnly = true)
    public WeddingWebsite getBySlug(String slug) {
        WeddingWebsite website = websiteRepository.findBySlug(slug)
                .orElseThrow(() -> new WeddingWebsiteNotFoundException(slug));
        if (website.isDeleted()) throw new WeddingWebsiteNotFoundException(slug);
        return website;
    }

    @Transactional(readOnly = true)
    public List<WeddingWebsite> getAllPublished() {
        return websiteRepository.findAllPublished();
    }

    @Transactional
    public void delete(UUID coupleId) {
        websiteRepository.save(getByCoupleId(coupleId).deleted());
    }

    @Transactional
    public WeddingWebsite update(UUID coupleId, UpdateWeddingWebsiteRequest req) {
        WeddingWebsite existing = getByCoupleId(coupleId);

        // Patch semantics: only overwrite fields that are non-null in the request
        WeddingWebsite updated = new WeddingWebsite(
                existing.id(),
                existing.coupleId(),
                existing.slug(),
                existing.isPublished(),

                req.partnerOneName()    != null ? req.partnerOneName()    : existing.partnerOneName(),
                req.partnerTwoName()    != null ? req.partnerTwoName()    : existing.partnerTwoName(),
                req.weddingDate()       != null ? req.weddingDate()       : existing.weddingDate(),

                req.heroPhotoUrl()      != null ? req.heroPhotoUrl()      : existing.heroPhotoUrl(),
                req.ourStory()          != null ? req.ourStory()          : existing.ourStory(),
                req.testimony()         != null ? req.testimony()         : existing.testimony(),
                req.covenantStatement() != null ? req.covenantStatement() : existing.covenantStatement(),
                req.scriptureReference()!= null ? req.scriptureReference(): existing.scriptureReference(),
                req.scriptureText()     != null ? req.scriptureText()     : existing.scriptureText(),

                req.venueName()         != null ? req.venueName()         : existing.venueName(),
                req.venueAddress()      != null ? req.venueAddress()      : existing.venueAddress(),
                req.venueCity()         != null ? req.venueCity()         : existing.venueCity(),
                req.venueState()        != null ? req.venueState()        : existing.venueState(),
                req.ceremonyTime()      != null ? req.ceremonyTime()      : existing.ceremonyTime(),
                req.dressCode()         != null ? req.dressCode()         : existing.dressCode(),

                req.hotelName()         != null ? req.hotelName()         : existing.hotelName(),
                req.hotelUrl()          != null ? req.hotelUrl()          : existing.hotelUrl(),
                req.hotelDetails()      != null ? req.hotelDetails()      : existing.hotelDetails(),

                req.registryUrl1()      != null ? req.registryUrl1()      : existing.registryUrl1(),
                req.registryLabel1()    != null ? req.registryLabel1()    : existing.registryLabel1(),
                req.registryUrl2()      != null ? req.registryUrl2()      : existing.registryUrl2(),
                req.registryLabel2()    != null ? req.registryLabel2()    : existing.registryLabel2(),
                req.registryUrl3()      != null ? req.registryUrl3()      : existing.registryUrl3(),
                req.registryLabel3()    != null ? req.registryLabel3()    : existing.registryLabel3(),

                req.rsvpDeadline()      != null ? req.rsvpDeadline()      : existing.rsvpDeadline(),

                existing.isDeleted(), existing.deletedAt(),
                existing.createdAt(),
                LocalDateTime.now()
        );
        WeddingWebsite saved = websiteRepository.save(updated);
        revalidationPort.revalidateWeddingPage(saved.slug());
        return saved;
    }

    @Transactional
    public WeddingWebsite publish(UUID coupleId) {
        WeddingWebsite saved = websiteRepository.save(getByCoupleId(coupleId).published());
        revalidationPort.revalidateWeddingPage(saved.slug());
        return saved;
    }

    @Transactional
    public WeddingWebsite unpublish(UUID coupleId) {
        WeddingWebsite saved = websiteRepository.save(getByCoupleId(coupleId).unpublished());
        revalidationPort.revalidateWeddingPage(saved.slug());
        return saved;
    }
}
