package com.altarwed.application.service;

import com.altarwed.application.dto.CreateWeddingWebsiteRequest;
import com.altarwed.application.dto.UpdateWeddingWebsiteRequest;
import com.altarwed.application.dto.WeddingWebsiteSearchResultResponse;
import com.altarwed.domain.exception.SlugAlreadyTakenException;
import com.altarwed.domain.exception.WeddingWebsiteAlreadyExistsException;
import com.altarwed.domain.exception.WeddingWebsiteNotFoundException;
import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.domain.port.ConversionEventPort;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.RevalidationPort;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class WeddingWebsiteService {

    private static final Logger log = LoggerFactory.getLogger(WeddingWebsiteService.class);

    // Core tabs that cannot be hidden: HOME is the landing page, RSVP is the
    // whole point of the platform. The frontend disables these checkboxes in
    // the settings panel, but we strip them here too so that any direct API
    // call (or future bug) cannot leave a guest unable to RSVP.
    private static final Set<String> HARD_VISIBLE_TABS = Set.of("HOME", "RSVP");

    // Removes HOME/RSVP from a hiddenTabs CSV. Returns the sanitised string or
    // null if the input is null/blank.
    private static String sanitiseHiddenTabs(String csv) {
        if (csv == null) return null;
        String cleaned = Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .filter(s -> !HARD_VISIBLE_TABS.contains(s))
                .distinct()
                .sorted()
                .collect(Collectors.joining(","));
        return cleaned;
    }

    private final WeddingWebsiteRepository websiteRepository;
    private final RevalidationPort revalidationPort;
    private final CoupleRepository coupleRepository;
    private final ConversionEventPort conversionEventPort;

    public WeddingWebsiteService(
            WeddingWebsiteRepository websiteRepository,
            RevalidationPort revalidationPort,
            CoupleRepository coupleRepository,
            ConversionEventPort conversionEventPort
    ) {
        this.websiteRepository = websiteRepository;
        this.revalidationPort = revalidationPort;
        this.coupleRepository = coupleRepository;
        this.conversionEventPort = conversionEventPort;
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

        log.info("wedding website creation started, coupleId={}, slug={}", coupleId, slug);
        WeddingWebsite website = new WeddingWebsite(
                null, coupleId, slug, false,
                request.partnerOneName(), request.partnerTwoName(), request.weddingDate(),
                null, null, null,                          // heroPhotoUrl, heroTagline, ourStory
                null, null,                                // scriptureReference, scriptureText
                null, null, null, null, null, null,        // venue + ceremonyTime + dressCode
                null, null, null,                          // hotel
                null, null, null, null, null, null,        // registry 1/2/3
                null,                                      // rsvpDeadline
                null, null,                                // vows
                null,                                      // goalBudget
                null, null,                                // hiddenTabs, customTabLabels (V34)
                false, null,
                LocalDateTime.now(), LocalDateTime.now()
        );
        WeddingWebsite saved = websiteRepository.save(website);
        log.info("wedding website created, coupleId={}, websiteId={}, slug={}",
                 coupleId, saved.id(), saved.slug());
        return saved;
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
        log.info("wedding website deletion started, coupleId={}", coupleId);
        websiteRepository.save(getByCoupleId(coupleId).deleted());
    }

    @Transactional
    public WeddingWebsite update(UUID coupleId, UpdateWeddingWebsiteRequest req) {
        WeddingWebsite existing = getByCoupleId(coupleId);

        WeddingWebsite updated = new WeddingWebsite(
                existing.id(),
                existing.coupleId(),
                existing.slug(),
                existing.isPublished(),

                req.partnerOneName()    != null ? req.partnerOneName()    : existing.partnerOneName(),
                req.partnerTwoName()    != null ? req.partnerTwoName()    : existing.partnerTwoName(),
                req.weddingDate()       != null ? req.weddingDate()       : existing.weddingDate(),

                req.heroPhotoUrl()      != null ? req.heroPhotoUrl()      : existing.heroPhotoUrl(),
                req.heroTagline()       != null ? req.heroTagline()       : existing.heroTagline(),
                req.ourStory()          != null ? req.ourStory()          : existing.ourStory(),
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

                req.partnerOneVows()    != null ? req.partnerOneVows()    : existing.partnerOneVows(),
                req.partnerTwoVows()    != null ? req.partnerTwoVows()    : existing.partnerTwoVows(),

                req.goalBudget()        != null ? req.goalBudget()        : existing.goalBudget(),

                // Strip HOME/RSVP from the hiddenTabs CSV before persisting so a
                // direct API call cannot hide them. The frontend already disables
                // those checkboxes; this is defence at the boundary.
                req.hiddenTabs()        != null ? sanitiseHiddenTabs(req.hiddenTabs()) : existing.hiddenTabs(),
                req.customTabLabels()   != null ? req.customTabLabels()   : existing.customTabLabels(),

                existing.isDeleted(), existing.deletedAt(),
                existing.createdAt(),
                LocalDateTime.now()
        );
        WeddingWebsite saved = websiteRepository.save(updated);
        revalidationPort.revalidateWeddingPage(saved.slug());
        return saved;
    }

    @Transactional
    public void updateHeroPhoto(UUID websiteId, String photoUrl) {
        WeddingWebsite existing = websiteRepository.findById(websiteId)
                .orElseThrow(() -> new WeddingWebsiteNotFoundException(websiteId.toString()));
        WeddingWebsite updated = new WeddingWebsite(
                existing.id(), existing.coupleId(), existing.slug(), existing.isPublished(),
                existing.partnerOneName(), existing.partnerTwoName(), existing.weddingDate(),
                photoUrl, existing.heroTagline(),
                existing.ourStory(),
                existing.scriptureReference(), existing.scriptureText(),
                existing.venueName(), existing.venueAddress(), existing.venueCity(),
                existing.venueState(), existing.ceremonyTime(), existing.dressCode(),
                existing.hotelName(), existing.hotelUrl(), existing.hotelDetails(),
                existing.registryUrl1(), existing.registryLabel1(),
                existing.registryUrl2(), existing.registryLabel2(),
                existing.registryUrl3(), existing.registryLabel3(),
                existing.rsvpDeadline(),
                existing.partnerOneVows(), existing.partnerTwoVows(),
                existing.goalBudget(),
                existing.hiddenTabs(), existing.customTabLabels(),
                existing.isDeleted(), existing.deletedAt(),
                existing.createdAt(), LocalDateTime.now()
        );
        WeddingWebsite saved = websiteRepository.save(updated);
        revalidationPort.revalidateWeddingPage(saved.slug());
    }

    @Transactional
    public WeddingWebsite publish(UUID coupleId) {
        WeddingWebsite saved = websiteRepository.save(getByCoupleId(coupleId).published());
        log.info("wedding website published, coupleId={}, websiteId={}, slug={}",
                 coupleId, saved.id(), saved.slug());
        revalidationPort.revalidateWeddingPage(saved.slug());
        fireLeadEventIfConsented(coupleId, saved.slug());
        return saved;
    }

    private void fireLeadEventIfConsented(UUID coupleId, String slug) {
        coupleRepository.findById(coupleId).ifPresent(couple -> {
            if (!couple.marketingConsent()) return;
            String emailHash = EmailSuppressionService.emailHash(couple.email());
            String eventUrl = "https://www.altarwed.com/wedding/" + slug;
            conversionEventPort.reportLead(emailHash, eventUrl, coupleId.toString());
        });
    }

    @Transactional
    public WeddingWebsite unpublish(UUID coupleId) {
        WeddingWebsite saved = websiteRepository.save(getByCoupleId(coupleId).unpublished());
        log.info("wedding website unpublished, coupleId={}, websiteId={}, slug={}",
                 coupleId, saved.id(), saved.slug());
        revalidationPort.revalidateWeddingPage(saved.slug());
        return saved;
    }

    public List<WeddingWebsiteSearchResultResponse> search(String name, Integer year) {
        String nameParam = (name == null || name.isBlank()) ? null : name.trim();
        return websiteRepository.searchPublishedByNameAndYear(nameParam, year)
                .stream()
                .map(w -> new WeddingWebsiteSearchResultResponse(
                        w.slug(), w.partnerOneName(), w.partnerTwoName(),
                        w.weddingDate(), w.venueCity(), w.venueState()))
                .toList();
    }
}
