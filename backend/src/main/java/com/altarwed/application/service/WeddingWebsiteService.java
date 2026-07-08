package com.altarwed.application.service;

import com.altarwed.application.dto.CreateWeddingWebsiteRequest;
import com.altarwed.application.dto.UpdateWeddingWebsiteRequest;
import com.altarwed.application.dto.WeddingPageBlockResponse;
import com.altarwed.application.dto.WeddingWebsiteExport;
import com.altarwed.application.dto.WeddingWebsiteResponse;
import com.altarwed.application.dto.WeddingWebsiteSearchResultResponse;
import com.altarwed.domain.exception.SlugAlreadyTakenException;
import com.altarwed.domain.exception.WeddingWebsiteAlreadyExistsException;
import com.altarwed.domain.exception.WeddingWebsiteNotFoundException;
import com.altarwed.domain.model.WeddingPageBlock;
import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.domain.model.WeddingWebsiteSummary;
import com.altarwed.domain.port.ConversionEventPort;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.RevalidationPort;
import com.altarwed.domain.port.WeddingPageBlockRepository;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    private final AsyncEmailService asyncEmailService;
    private final WeddingPageBlockRepository blockRepository;
    private final ObjectMapper objectMapper;

    public WeddingWebsiteService(
            WeddingWebsiteRepository websiteRepository,
            RevalidationPort revalidationPort,
            CoupleRepository coupleRepository,
            ConversionEventPort conversionEventPort,
            AsyncEmailService asyncEmailService,
            WeddingPageBlockRepository blockRepository,
            ObjectMapper objectMapper
    ) {
        this.websiteRepository = websiteRepository;
        this.revalidationPort = revalidationPort;
        this.coupleRepository = coupleRepository;
        this.conversionEventPort = conversionEventPort;
        this.asyncEmailService = asyncEmailService;
        this.blockRepository = blockRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public WeddingWebsite create(UUID coupleId, String coupleEmail, CreateWeddingWebsiteRequest request) {
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
                null,                          // engagementDate (set later via Details/checklist)
                null, null, null, null, null,  // heroPhotoUrl, heroTagline, focalPointX/Y, taglineColor
                null,                          // ourStory
                null, null, null,              // scriptureReference, scriptureText, scriptureTranslation
                null, null, null, null, null, null,  // venue + ceremonyTime + dressCode
                null, null,                    // venuePhotoUrl, venueAdditionalInfo
                null, null, null,              // hotel
                null, null, null, null, null, null,  // registry 1/2/3
                null,                          // rsvpDeadline
                null, null,                    // vows
                null,                          // goalBudget
                null, null,                    // hiddenTabs, customTabLabels (V34)
                null,                          // accentColor (V59)
                null,                          // scriptureBackgroundColor (V62)
                null,                          // stdImageUrl (V65)
                false, null,
                LocalDateTime.now(), LocalDateTime.now()
        );
        WeddingWebsite saved = websiteRepository.save(website);
        log.info("wedding website created, coupleId={}, websiteId={}, slug={}",
                 coupleId, saved.id(), saved.slug());

        String siteUrl = "https://www.altarwed.com/wedding/" + saved.slug();
        asyncEmailService.sendCoupleWebsiteCreatedAlert(
                coupleEmail, saved.partnerOneName(), saved.partnerTwoName(), saved.slug(), siteUrl);
        log.info("couple website created alert queued, coupleId={}", coupleId);

        return saved;
    }

    @Transactional(readOnly = true)
    public WeddingWebsite getByCoupleId(UUID coupleId) {
        return websiteRepository.findByCoupleId(coupleId)
                .orElseThrow(() -> new WeddingWebsiteNotFoundException("couple:" + coupleId));
    }

    /**
     * Serializes this couple's wedding website to a portable JSON string for the self-serve data
     * export (issue #253): the scalar site fields plus every page-builder block in sort order.
     * Read-only and couple-scoped; the caller (CoupleExportController) has already asserted
     * ownership via CoupleAccessGuard, and this reads only the couple's own site and its blocks.
     *
     * Pretty-printed for human readability (a couple opening the file should be able to read it).
     * Throws {@link WeddingWebsiteNotFoundException} when the couple has no site yet, consistent
     * with the rest of this service.
     */
    @Transactional(readOnly = true)
    public String exportWebsiteJson(UUID coupleId) {
        WeddingWebsite site = getByCoupleId(coupleId);
        List<WeddingPageBlockResponse> blocks = blockRepository.findAllByWebsiteId(site.id()).stream()
                .map(WeddingWebsiteService::toBlockResponse)
                .toList();
        WeddingWebsiteExport export = new WeddingWebsiteExport(toWebsiteResponse(site), blocks);
        try {
            String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(export);
            log.info("wedding website exported, coupleId={}, websiteId={}, blockCount={}",
                     coupleId, site.id(), blocks.size());
            return json;
        } catch (JsonProcessingException e) {
            log.error("wedding website export failed, coupleId={}, websiteId={}", coupleId, site.id(), e);
            throw new IllegalStateException("Failed to serialize wedding website export", e);
        }
    }

    // Domain -> export DTO mappers. Kept private/static here (not the web WeddingWebsiteMapper)
    // so the application layer builds its own export payload without depending on the web layer.
    private static WeddingWebsiteResponse toWebsiteResponse(WeddingWebsite w) {
        return new WeddingWebsiteResponse(
                w.id(), w.coupleId(), w.slug(), w.isPublished(),
                w.partnerOneName(), w.partnerTwoName(), w.weddingDate(), w.engagementDate(),
                w.heroPhotoUrl(), w.heroTagline(), w.heroFocalPointX(), w.heroFocalPointY(), w.heroTaglineColor(),
                w.ourStory(), w.scriptureReference(), w.scriptureText(), w.scriptureTranslation(),
                w.venueName(), w.venueAddress(), w.venueCity(), w.venueState(), w.ceremonyTime(), w.dressCode(),
                w.venuePhotoUrl(), w.venueAdditionalInfo(),
                w.hotelName(), w.hotelUrl(), w.hotelDetails(),
                w.registryUrl1(), w.registryLabel1(), w.registryUrl2(), w.registryLabel2(),
                w.registryUrl3(), w.registryLabel3(),
                w.rsvpDeadline(), w.partnerOneVows(), w.partnerTwoVows(), w.goalBudget(),
                w.hiddenTabs(), w.customTabLabels(), w.accentColor(), w.scriptureBackgroundColor(),
                w.stdImageUrl(), w.createdAt(), w.updatedAt()
        );
    }

    private static WeddingPageBlockResponse toBlockResponse(WeddingPageBlock b) {
        return new WeddingPageBlockResponse(
                b.id(), b.weddingWebsiteId(), b.tab(), b.type(),
                b.sortOrder(), b.contentJson(), b.createdAt(), b.updatedAt()
        );
    }

    // Public path (SEO surface, /wedding/[slug] and friends). Slugs are low-entropy and
    // guessable, so an unpublished site must 404 here the same as a deleted one, or anyone
    // can read a couple's draft (names, venue, vows, goalBudget) before they consent to
    // publish (#91). Use getBySlugForPreview for the owner-only editor preview.
    @Transactional(readOnly = true)
    public WeddingWebsite getBySlug(String slug) {
        WeddingWebsite website = websiteRepository.findBySlug(slug)
                .orElseThrow(() -> new WeddingWebsiteNotFoundException(slug));
        if (website.isDeleted() || !website.isPublished()) throw new WeddingWebsiteNotFoundException(slug);
        return website;
    }

    // Owner-only preview path (SideBySideEditor iframe -> frontend-public /preview/[slug]/[tab]).
    // The two Next.js/Spring origins don't share a session, so no JWT crosses into the iframe;
    // the slug itself is the capability, same as before this method existed. Deliberately does
    // NOT gate on isPublished -- previewing a draft before publish is the entire point.
    @Transactional(readOnly = true)
    public WeddingWebsite getBySlugForPreview(String slug) {
        WeddingWebsite website = websiteRepository.findBySlug(slug)
                .orElseThrow(() -> new WeddingWebsiteNotFoundException(slug));
        if (website.isDeleted()) throw new WeddingWebsiteNotFoundException(slug);
        return website;
    }

    // Sitemap feed page-size ceiling. The public /published endpoint is unauthenticated, so a
    // caller must never be able to request an arbitrarily large page and stream the whole
    // published-sites table in one query (issue #241). 1000 keeps the number of sequential paged
    // requests the sitemap loader makes small while bounding per-query memory.
    static final int MAX_SITEMAP_PAGE_SIZE = 1000;

    // Returns one id-ordered page of published, non-deleted site summaries for the sitemap. Page
    // and size are clamped defensively so a hostile or buggy caller cannot request a negative page
    // or a page larger than the server-side ceiling. The sitemap loader iterates pages until one
    // returns fewer than `size` rows.
    @Transactional(readOnly = true)
    public List<WeddingWebsiteSummary> getPublishedPage(int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), MAX_SITEMAP_PAGE_SIZE);
        return websiteRepository.findPublishedSummaries(safePage, safeSize);
    }

    // Current hero / venue / save-the-date blob URLs for a website, so a replace or remove can delete
    // the prior blob after the new state is persisted (issue #101 orphan-blob cleanup). Returns null
    // when the website or the field is unset, which MediaUploadService.deleteBlobBestEffort treats as
    // a no-op. These live here, on the service that owns those fields, so the controller reads the old
    // URL through a service rather than a repository (web -> application -> domain).
    @Transactional(readOnly = true)
    public String currentHeroPhotoUrl(UUID websiteId) {
        return websiteRepository.findById(websiteId).map(WeddingWebsite::heroPhotoUrl).orElse(null);
    }

    @Transactional(readOnly = true)
    public String currentVenuePhotoUrl(UUID websiteId) {
        return websiteRepository.findById(websiteId).map(WeddingWebsite::venuePhotoUrl).orElse(null);
    }

    @Transactional(readOnly = true)
    public String currentStdImageUrl(UUID websiteId) {
        return websiteRepository.findById(websiteId).map(WeddingWebsite::stdImageUrl).orElse(null);
    }

    @Transactional
    public void delete(UUID coupleId) {
        log.info("wedding website deletion started, coupleId={}", coupleId);
        WeddingWebsite existing = getByCoupleId(coupleId);
        websiteRepository.save(existing.deleted());
        revalidationPort.revalidateWeddingPage(existing.slug());
        log.info("wedding website deletion completed, coupleId={}", coupleId);
    }

    @Transactional
    public void deleteBySlug(String slug) {
        String normalised = slug.toLowerCase();
        log.info("admin website deletion started, slug={}", normalised);
        WeddingWebsite existing = websiteRepository.findBySlug(normalised)
                .orElseThrow(() -> new WeddingWebsiteNotFoundException(normalised));
        if (existing.isDeleted()) {
            log.info("admin website deletion skipped, already deleted, slug={}", normalised);
            return;
        }
        websiteRepository.save(existing.deleted());
        revalidationPort.revalidateWeddingPage(normalised);
    }

    @Transactional
    public WeddingWebsite update(UUID coupleId, UpdateWeddingWebsiteRequest req) {
        WeddingWebsite existing = getByCoupleId(coupleId);

        WeddingWebsite updated = new WeddingWebsite(
                existing.id(),
                existing.coupleId(),
                existing.slug(),
                existing.isPublished(),

                req.partnerOneName()         != null ? req.partnerOneName()         : existing.partnerOneName(),
                req.partnerTwoName()         != null ? req.partnerTwoName()         : existing.partnerTwoName(),
                req.weddingDate()            != null ? req.weddingDate()            : existing.weddingDate(),
                req.engagementDate()         != null ? req.engagementDate()         : existing.engagementDate(),

                req.heroPhotoUrl()           != null ? req.heroPhotoUrl()           : existing.heroPhotoUrl(),
                req.heroTagline()            != null ? req.heroTagline()            : existing.heroTagline(),
                req.heroFocalPointX()        != null ? req.heroFocalPointX()        : existing.heroFocalPointX(),
                req.heroFocalPointY()        != null ? req.heroFocalPointY()        : existing.heroFocalPointY(),
                req.heroTaglineColor()       != null ? req.heroTaglineColor()       : existing.heroTaglineColor(),

                req.ourStory()               != null ? req.ourStory()               : existing.ourStory(),
                req.scriptureReference()     != null ? req.scriptureReference()     : existing.scriptureReference(),
                req.scriptureText()          != null ? req.scriptureText()          : existing.scriptureText(),
                req.scriptureTranslation()   != null ? req.scriptureTranslation()   : existing.scriptureTranslation(),

                req.venueName()              != null ? req.venueName()              : existing.venueName(),
                req.venueAddress()           != null ? req.venueAddress()           : existing.venueAddress(),
                req.venueCity()              != null ? req.venueCity()              : existing.venueCity(),
                req.venueState()             != null ? req.venueState()             : existing.venueState(),
                req.ceremonyTime()           != null ? req.ceremonyTime()           : existing.ceremonyTime(),
                req.dressCode()              != null ? req.dressCode()              : existing.dressCode(),
                req.venuePhotoUrl()          != null ? req.venuePhotoUrl()          : existing.venuePhotoUrl(),
                req.venueAdditionalInfo()    != null ? req.venueAdditionalInfo()    : existing.venueAdditionalInfo(),

                req.hotelName()              != null ? req.hotelName()              : existing.hotelName(),
                req.hotelUrl()               != null ? req.hotelUrl()               : existing.hotelUrl(),
                req.hotelDetails()           != null ? req.hotelDetails()           : existing.hotelDetails(),

                req.registryUrl1()           != null ? req.registryUrl1()           : existing.registryUrl1(),
                req.registryLabel1()         != null ? req.registryLabel1()         : existing.registryLabel1(),
                req.registryUrl2()           != null ? req.registryUrl2()           : existing.registryUrl2(),
                req.registryLabel2()         != null ? req.registryLabel2()         : existing.registryLabel2(),
                req.registryUrl3()           != null ? req.registryUrl3()           : existing.registryUrl3(),
                req.registryLabel3()         != null ? req.registryLabel3()         : existing.registryLabel3(),

                req.rsvpDeadline()           != null ? req.rsvpDeadline()           : existing.rsvpDeadline(),

                req.partnerOneVows()         != null ? req.partnerOneVows()         : existing.partnerOneVows(),
                req.partnerTwoVows()         != null ? req.partnerTwoVows()         : existing.partnerTwoVows(),

                req.goalBudget()             != null ? req.goalBudget()             : existing.goalBudget(),

                // Strip HOME/RSVP from the hiddenTabs CSV before persisting so a
                // direct API call cannot hide them. The frontend already disables
                // those checkboxes; this is defence at the boundary.
                req.hiddenTabs()             != null ? sanitiseHiddenTabs(req.hiddenTabs()) : existing.hiddenTabs(),
                req.customTabLabels()        != null ? req.customTabLabels()        : existing.customTabLabels(),

                req.accentColor()            != null ? req.accentColor()            : existing.accentColor(),
                req.scriptureBackgroundColor() != null
                        ? (req.scriptureBackgroundColor().isBlank() ? null : req.scriptureBackgroundColor())
                        : existing.scriptureBackgroundColor(),

                existing.stdImageUrl(),

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
                existing.engagementDate(),
                photoUrl, existing.heroTagline(),
                existing.heroFocalPointX(), existing.heroFocalPointY(), existing.heroTaglineColor(),
                existing.ourStory(),
                existing.scriptureReference(), existing.scriptureText(), existing.scriptureTranslation(),
                existing.venueName(), existing.venueAddress(), existing.venueCity(),
                existing.venueState(), existing.ceremonyTime(), existing.dressCode(),
                existing.venuePhotoUrl(), existing.venueAdditionalInfo(),
                existing.hotelName(), existing.hotelUrl(), existing.hotelDetails(),
                existing.registryUrl1(), existing.registryLabel1(),
                existing.registryUrl2(), existing.registryLabel2(),
                existing.registryUrl3(), existing.registryLabel3(),
                existing.rsvpDeadline(),
                existing.partnerOneVows(), existing.partnerTwoVows(),
                existing.goalBudget(),
                existing.hiddenTabs(), existing.customTabLabels(),
                existing.accentColor(), existing.scriptureBackgroundColor(),
                existing.stdImageUrl(),
                existing.isDeleted(), existing.deletedAt(),
                existing.createdAt(), LocalDateTime.now()
        );
        WeddingWebsite saved = websiteRepository.save(updated);
        revalidationPort.revalidateWeddingPage(saved.slug());
    }

    @Transactional
    public void updateVenuePhoto(UUID websiteId, String photoUrl) {
        log.info("venue photo update started, websiteId={}", websiteId);
        WeddingWebsite existing = websiteRepository.findById(websiteId)
                .orElseThrow(() -> new WeddingWebsiteNotFoundException(websiteId.toString()));
        WeddingWebsite updated = new WeddingWebsite(
                existing.id(), existing.coupleId(), existing.slug(), existing.isPublished(),
                existing.partnerOneName(), existing.partnerTwoName(), existing.weddingDate(),
                existing.engagementDate(),
                existing.heroPhotoUrl(), existing.heroTagline(),
                existing.heroFocalPointX(), existing.heroFocalPointY(), existing.heroTaglineColor(),
                existing.ourStory(),
                existing.scriptureReference(), existing.scriptureText(), existing.scriptureTranslation(),
                existing.venueName(), existing.venueAddress(), existing.venueCity(),
                existing.venueState(), existing.ceremonyTime(), existing.dressCode(),
                photoUrl, existing.venueAdditionalInfo(),
                existing.hotelName(), existing.hotelUrl(), existing.hotelDetails(),
                existing.registryUrl1(), existing.registryLabel1(),
                existing.registryUrl2(), existing.registryLabel2(),
                existing.registryUrl3(), existing.registryLabel3(),
                existing.rsvpDeadline(),
                existing.partnerOneVows(), existing.partnerTwoVows(),
                existing.goalBudget(),
                existing.hiddenTabs(), existing.customTabLabels(),
                existing.accentColor(), existing.scriptureBackgroundColor(),
                existing.stdImageUrl(),
                existing.isDeleted(), existing.deletedAt(),
                existing.createdAt(), LocalDateTime.now()
        );
        WeddingWebsite saved = websiteRepository.save(updated);
        log.info("venue photo updated, websiteId={}", websiteId);
        revalidationPort.revalidateWeddingPage(saved.slug());
    }

    @Transactional
    public void updateStdImage(UUID websiteId, String imageUrl) {
        log.info("std image update started, websiteId={}", websiteId);
        WeddingWebsite existing = websiteRepository.findById(websiteId)
                .orElseThrow(() -> new WeddingWebsiteNotFoundException(websiteId.toString()));
        WeddingWebsite updated = new WeddingWebsite(
                existing.id(), existing.coupleId(), existing.slug(), existing.isPublished(),
                existing.partnerOneName(), existing.partnerTwoName(), existing.weddingDate(),
                existing.engagementDate(),
                existing.heroPhotoUrl(), existing.heroTagline(),
                existing.heroFocalPointX(), existing.heroFocalPointY(), existing.heroTaglineColor(),
                existing.ourStory(),
                existing.scriptureReference(), existing.scriptureText(), existing.scriptureTranslation(),
                existing.venueName(), existing.venueAddress(), existing.venueCity(),
                existing.venueState(), existing.ceremonyTime(), existing.dressCode(),
                existing.venuePhotoUrl(), existing.venueAdditionalInfo(),
                existing.hotelName(), existing.hotelUrl(), existing.hotelDetails(),
                existing.registryUrl1(), existing.registryLabel1(),
                existing.registryUrl2(), existing.registryLabel2(),
                existing.registryUrl3(), existing.registryLabel3(),
                existing.rsvpDeadline(),
                existing.partnerOneVows(), existing.partnerTwoVows(),
                existing.goalBudget(),
                existing.hiddenTabs(), existing.customTabLabels(),
                existing.accentColor(), existing.scriptureBackgroundColor(),
                imageUrl,
                existing.isDeleted(), existing.deletedAt(),
                existing.createdAt(), LocalDateTime.now()
        );
        websiteRepository.save(updated);
        log.info("std image updated, websiteId={}", websiteId);
    }

    @Transactional
    public WeddingWebsite publish(UUID coupleId) {
        WeddingWebsite before = getByCoupleId(coupleId);
        boolean wasAlreadyPublished = before.isPublished();
        WeddingWebsite saved = websiteRepository.save(before.published());
        log.info("wedding website published, coupleId={}, websiteId={}, slug={}",
                 coupleId, saved.id(), saved.slug());
        revalidationPort.revalidateWeddingPage(saved.slug());
        fireLeadEventIfConsented(coupleId, saved.slug());
        // Only send the "your site is live" email on the first publish, not re-publishes.
        if (!wasAlreadyPublished) {
            coupleRepository.findById(coupleId).ifPresent(couple -> {
                String weddingUrl = "https://www.altarwed.com/wedding/" + saved.slug();
                asyncEmailService.sendWeddingPublishedEmail(
                        couple.email(), saved.partnerOneName(), saved.partnerTwoName(), weddingUrl);
            });
        }
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
        // The repository already pages the query to MAX_SEARCH_RESULTS at the database;
        // the limit here is a defensive second layer so a blank-filter request can never
        // return the whole published-sites table even if the adapter changes.
        return websiteRepository.searchPublishedByNameAndYear(nameParam, year)
                .stream()
                .limit(WeddingWebsiteRepository.MAX_SEARCH_RESULTS)
                .map(w -> new WeddingWebsiteSearchResultResponse(
                        w.slug(), w.partnerOneName(), w.partnerTwoName(),
                        w.weddingDate(), w.venueCity(), w.venueState()))
                .toList();
    }
}
