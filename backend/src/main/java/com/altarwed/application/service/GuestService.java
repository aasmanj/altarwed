package com.altarwed.application.service;

import com.altarwed.application.dto.*;
import com.altarwed.domain.exception.CaptchaVerificationFailedException;
import com.altarwed.domain.exception.GuestNotFoundException;
import com.altarwed.domain.exception.GuestUnsubscribedException;
import com.altarwed.domain.exception.InvalidRsvpTokenException;
import com.altarwed.domain.model.*;
import com.altarwed.domain.port.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class GuestService {

    private static final Logger log = LoggerFactory.getLogger(GuestService.class);
    private static final int INVITE_EXPIRY_DAYS = 30;
    private static final int MAX_INVITE_SENDS = 3;
    private static final int SEARCH_TOKEN_EXPIRY_HOURS = 1;
    // The public find-invitation search ignores queries shorter than this so a short guess
    // cannot enumerate masked names or mint tokens by brute force. Raised from 2 to 4 (issue
    // #89): a 2-character "contains" match returns real guests for common prefixes ("Jo", "An"),
    // enabling anonymous enumeration of a wedding's guest list. 4 characters still lets a real
    // guest type a fragment of their own name (first name or last name) with zero friction,
    // while ruling out the shortest, highest-yield scripted guesses. Public so the controller's
    // pre-check shares one source of truth and cannot silently drift from the service.
    public static final int MIN_SEARCH_QUERY_LENGTH = 4;

    private final GuestRepository guestRepository;
    private final RsvpInviteTokenRepository tokenRepository;
    private final WeddingWebsiteRepository websiteRepository;
    private final CoupleRepository coupleRepository;
    private final AsyncEmailService asyncEmailService;
    private final EmailSuppressionService suppressionService;
    private final CustomRsvpQuestionService customRsvpQuestionService;
    private final CaptchaVerificationPort captchaVerificationPort;

    public GuestService(
            GuestRepository guestRepository,
            RsvpInviteTokenRepository tokenRepository,
            WeddingWebsiteRepository websiteRepository,
            CoupleRepository coupleRepository,
            AsyncEmailService asyncEmailService,
            EmailSuppressionService suppressionService,
            CustomRsvpQuestionService customRsvpQuestionService,
            CaptchaVerificationPort captchaVerificationPort
    ) {
        this.guestRepository = guestRepository;
        this.tokenRepository = tokenRepository;
        this.websiteRepository = websiteRepository;
        this.coupleRepository = coupleRepository;
        this.asyncEmailService = asyncEmailService;
        this.suppressionService = suppressionService;
        this.customRsvpQuestionService = customRsvpQuestionService;
        this.captchaVerificationPort = captchaVerificationPort;
    }

    @Transactional
    public List<Guest> addGuestsBulk(UUID coupleId, List<com.altarwed.application.dto.CreateGuestRequest> reqs) {
        List<Guest> guests = reqs.stream().map(req -> new Guest(
                null, coupleId, req.name(), req.email(), req.phone(),
                GuestRsvpStatus.PENDING, Boolean.TRUE.equals(req.plusOneAllowed()), null,
                req.dietaryRestrictions(), null,
                null, req.side(), req.notes(),
                req.mailLine1(), req.mailCity(), req.mailState(), req.mailZip(), req.mailCountry(),
                null, 0,
                null, null, null, null, LocalDateTime.now(), LocalDateTime.now(),
                req.partyId(), req.partyName(),
                req.partyContact() != null ? req.partyContact() : false,
                null, false  // sheetSyncId, syncedFromSheet: manually added guest
        )).toList();
        return guestRepository.saveAll(guests);
    }

    @Transactional
    public Guest addGuest(UUID coupleId, CreateGuestRequest req) {
        PartyResolution party = resolveParty(coupleId, req.partyId(), req.partyName());
        Guest guest = new Guest(
                null, coupleId, req.name(), req.email(), req.phone(),
                GuestRsvpStatus.PENDING, Boolean.TRUE.equals(req.plusOneAllowed()), null,
                req.dietaryRestrictions(), null,
                null, req.side(), req.notes(),
                req.mailLine1(), req.mailCity(), req.mailState(), req.mailZip(), req.mailCountry(),
                null, 0,
                null, null, null, null, LocalDateTime.now(), LocalDateTime.now(),
                party.partyId(),
                req.partyName() != null && !req.partyName().isBlank() ? req.partyName() : null,
                // Caller's choice wins; otherwise the first guest in a brand-new party is its contact.
                req.partyContact() != null ? req.partyContact() : party.isNew(),
                null, false  // sheetSyncId, syncedFromSheet: manually added guest
        );
        return guestRepository.save(guest);
    }

    /**
     * Creates a named party of guests who share a party_id. The first member
     * in the list is automatically designated as the party contact (the one
     * who receives the invite email). All members share the same partyId and
     * partyName. Returns the saved list.
     */
    @Transactional
    public List<Guest> createParty(UUID coupleId, com.altarwed.application.dto.CreatePartyRequest req) {
        UUID partyId = UUID.randomUUID();
        List<Guest> members = new java.util.ArrayList<>();
        for (int i = 0; i < req.members().size(); i++) {
            CreateGuestRequest m = req.members().get(i);
            boolean isContact = (i == 0);
            members.add(new Guest(
                    null, coupleId, m.name(), m.email(), m.phone(),
                    GuestRsvpStatus.PENDING, Boolean.TRUE.equals(m.plusOneAllowed()), null,
                    m.dietaryRestrictions(), null,
                    null, m.side(), m.notes(),
                    m.mailLine1(), m.mailCity(), m.mailState(), m.mailZip(), m.mailCountry(),
                    null, 0,
                    null, null, null, null, LocalDateTime.now(), LocalDateTime.now(),
                    partyId, req.partyName(), isContact,
                    null, false  // sheetSyncId, syncedFromSheet: manually added guest
            ));
        }
        return guestRepository.saveAll(members);
    }

    @Transactional(readOnly = true)
    public List<Guest> listGuests(UUID coupleId) {
        return guestRepository.findAllByCoupleId(coupleId);
    }

    @Transactional
    public Guest updateGuest(UUID coupleId, UUID guestId, UpdateGuestRequest req) {
        Guest existing = getGuest(coupleId, guestId);

        // Party fields follow the same null-means-not-provided merge as the rest of the
        // update, with one extra rule: a non-blank partyName with no explicit partyId
        // resolves to an existing same-named party's id (joining it) or a fresh one
        // (starting it), and a blank partyName explicitly clears the guest's party.
        UUID newPartyId;
        String newPartyName;
        Boolean newPartyContact;
        if (req.partyId() != null) {
            newPartyId = req.partyId();
            newPartyName = req.partyName() != null ? req.partyName() : existing.partyName();
            newPartyContact = req.partyContact() != null ? req.partyContact() : existing.partyContact();
        } else if (req.partyName() == null) {
            newPartyId = existing.partyId();
            newPartyName = existing.partyName();
            newPartyContact = existing.partyContact();
        } else if (req.partyName().isBlank()) {
            newPartyId = null;
            newPartyName = null;
            newPartyContact = false;
        } else {
            PartyResolution party = resolveParty(coupleId, null, req.partyName());
            newPartyId = party.partyId();
            newPartyName = req.partyName();
            // Keep an explicit choice; starting a new party makes this guest its contact,
            // joining an existing one keeps their current contact flag.
            newPartyContact = req.partyContact() != null ? req.partyContact()
                    : (party.isNew() ? Boolean.TRUE : existing.partyContact());
        }

        Guest updated = new Guest(
                existing.id(), existing.coupleId(),
                req.name()               != null ? req.name()               : existing.name(),
                req.email()              != null ? (req.email().isBlank()              ? null : req.email())              : existing.email(),
                req.phone()              != null ? (req.phone().isBlank()              ? null : req.phone())              : existing.phone(),
                req.rsvpStatus()         != null ? req.rsvpStatus()         : existing.rsvpStatus(),
                req.plusOneAllowed()     != null ? req.plusOneAllowed()     : existing.plusOneAllowed(),
                req.plusOneName()        != null ? (req.plusOneName().isBlank()        ? null : req.plusOneName())        : existing.plusOneName(),
                req.dietaryRestrictions()!= null ? (req.dietaryRestrictions().isBlank() ? null : req.dietaryRestrictions()) : existing.dietaryRestrictions(),
                req.songRequest()        != null ? (req.songRequest().isBlank()        ? null : req.songRequest())        : existing.songRequest(),
                req.tableNumber()        != null ? req.tableNumber()        : existing.tableNumber(),
                req.side()               != null ? req.side()               : existing.side(),
                req.notes()              != null ? (req.notes().isBlank()              ? null : req.notes())              : existing.notes(),
                req.mailLine1()          != null ? (req.mailLine1().isBlank()          ? null : req.mailLine1())          : existing.mailLine1(),
                req.mailCity()           != null ? (req.mailCity().isBlank()           ? null : req.mailCity())           : existing.mailCity(),
                req.mailState()          != null ? (req.mailState().isBlank()          ? null : req.mailState())          : existing.mailState(),
                req.mailZip()            != null ? (req.mailZip().isBlank()            ? null : req.mailZip())            : existing.mailZip(),
                req.mailCountry()        != null ? (req.mailCountry().isBlank()        ? null : req.mailCountry())        : existing.mailCountry(),
                existing.noteForCouple(), existing.inviteSendCount(),
                existing.inviteSentAt(), existing.saveTheDateSentAt(), existing.respondedAt(), existing.remindAt(),
                existing.createdAt(), LocalDateTime.now(),
                newPartyId, newPartyName, newPartyContact,
                existing.sheetSyncId(), existing.syncedFromSheet()
        );
        return guestRepository.save(updated);
    }

    @Transactional
    public void removeGuest(UUID coupleId, UUID guestId) {
        if (!guestRepository.existsByIdAndCoupleId(guestId, coupleId)) {
            throw new GuestNotFoundException(guestId.toString());
        }
        guestRepository.deleteById(guestId);
    }

    @Transactional
    public Guest sendInvite(UUID coupleId, UUID guestId) {
        Guest guest = getGuest(coupleId, guestId);
        // Honour the unsubscribe for RSVP invites too: a guest who opted out of this
        // couple's mail (or whose address globally bounced/complained) must not be
        // emailed. They resubscribe by RSVPing on the wedding site; the couple can also
        // invite them another way (a printed card, a text).
        if (guest.email() != null && !guest.email().isBlank()
                && suppressionService.isSuppressed(coupleId, EmailSuppressionService.emailHash(guest.email()))) {
            log.warn("invite rejected, guest email unsubscribed, guestId={}, coupleId={}", guestId, coupleId);
            throw new GuestUnsubscribedException(
                    "This guest unsubscribed from your wedding emails. They can resubscribe by RSVPing on "
                    + "your wedding site, or you can invite them another way.");
        }
        return issueInvite(guest, coupleId);
    }

    @Transactional
    public SaveTheDateSendResult sendSaveDates(UUID coupleId, List<UUID> guestIds) {
        log.info("save-the-date send batch started, coupleId={}, targetCount={}", coupleId,
                guestIds == null ? "all" : guestIds.size());

        Set<UUID> guestIdSet = guestIds != null ? new HashSet<>(guestIds) : null;
        List<Guest> withEmail = guestRepository.findAllByCoupleId(coupleId).stream()
                .filter(g -> g.email() != null && !g.email().isBlank())
                .filter(g -> guestIdSet == null || guestIdSet.contains(g.id()))
                .toList();

        // Surface syntactically bad addresses so the couple can fix them at the source
        // (Google Sheet) and re-sync, instead of letting them silently 422 the batch.
        List<SaveTheDateSendResult.InvalidGuestEmail> invalid = withEmail.stream()
                .filter(g -> !EmailAddresses.isValid(g.email()))
                .map(g -> new SaveTheDateSendResult.InvalidGuestEmail(g.id(), g.name(), g.email()))
                .toList();

        // Of the valid addresses, drop opt-outs; only the remainder is actually queued.
        // Batch the suppression lookup (one global + one per-couple query for the whole
        // list) instead of an existence check per guest, so a large send is two
        // round-trips, not hundreds.
        List<Guest> valid = withEmail.stream()
                .filter(g -> EmailAddresses.isValid(g.email()))
                .toList();
        Set<String> suppressedHashes = suppressionService.reasonsByHash(coupleId,
                valid.stream().map(g -> EmailSuppressionService.emailHash(g.email())).toList()).keySet();
        List<Guest> queueable = valid.stream()
                .filter(g -> !suppressedHashes.contains(EmailSuppressionService.emailHash(g.email())))
                .toList();
        int validCount = valid.size();
        int suppressedCount = validCount - queueable.size();

        if (!queueable.isEmpty()) {
            var website = websiteRepository.findByCoupleId(coupleId).orElse(null);
            var couple  = coupleRepository.findById(coupleId).orElse(null);
            String coupleNames = couple != null
                    ? couple.partnerTwoName() + " & " + couple.partnerOneName()
                    : "The Couple";
            String weddingDate = (website != null && website.weddingDate() != null)
                    ? website.weddingDate().format(DateTimeFormatter.ofPattern("MMMM d, yyyy"))
                    : "TBD";
            String weddingUrl = website != null
                    ? "https://www.altarwed.com/wedding/" + website.slug()
                    : "https://www.altarwed.com";
            String stdImageUrl = website != null ? website.stdImageUrl() : null;

            List<EmailRecipient> recipients = queueable.stream()
                    .map(g -> new EmailRecipient(g.email(), g.name(), g.id()))
                    .toList();
            // Reply-To = this couple's own address so guest replies reach their inbox,
            // not the shared from-address.
            String coupleReplyTo = couple != null ? couple.email() : null;
            asyncEmailService.sendSaveTheDateEmails(recipients, coupleId, coupleNames, weddingDate, weddingUrl, stdImageUrl, coupleReplyTo);

            // Stamp save_the_date_sent_at only for guests we actually queued (valid and
            // not unsubscribed), so the dashboard never shows "sent" for an address we
            // skipped. Final delivered/bounced status arrives later via the delivery webhook.
            guestRepository.markSaveTheDatesSent(queueable.stream().map(Guest::id).toList(), LocalDateTime.now());
        }

        log.info("save-the-date send batch queued, coupleId={}, queued={}, invalid={}, suppressed={}",
                coupleId, queueable.size(), invalid.size(), suppressedCount);
        return new SaveTheDateSendResult(queueable.size(), invalid.size(), suppressedCount, invalid);
    }

    /**
     * Why a single guest's email is suppressed for THIS couple (USER_REQUEST / BOUNCE /
     * COMPLAINT), or null when the guest has no email or is deliverable. Stamps the
     * unsubscribe badge onto single-guest write responses so the dashboard's optimistic
     * cache stays accurate after an edit/invite without a full list refetch.
     */
    @Transactional(readOnly = true)
    public String unsubscribedReason(UUID coupleId, Guest guest) {
        if (guest == null || guest.email() == null || guest.email().isBlank()) return null;
        return suppressionService.reasonFor(coupleId, EmailSuppressionService.emailHash(guest.email()));
    }

    /**
     * Maps each suppressed guest in the list to its reason for THIS couple, batched (one
     * global + one per-couple query, no N+1). Takes already-loaded guests so the list
     * endpoint does not re-read the guest table. A blank/absent email yields no entry.
     */
    @Transactional(readOnly = true)
    public Map<UUID, String> unsubscribedSourcesByGuest(UUID coupleId, List<Guest> guests) {
        Map<String, UUID> hashToGuest = new HashMap<>();
        for (Guest g : guests) {
            if (g.email() != null && !g.email().isBlank()) {
                hashToGuest.put(EmailSuppressionService.emailHash(g.email()), g.id());
            }
        }
        if (hashToGuest.isEmpty()) return Map.of();
        Map<UUID, String> out = new HashMap<>();
        suppressionService.reasonsByHash(coupleId, hashToGuest.keySet()).forEach((hash, reason) -> {
            UUID guestId = hashToGuest.get(hash);
            if (guestId != null) out.put(guestId, reason);
        });
        return out;
    }

    @Transactional
    public int sendAllPendingInvites(UUID coupleId) {
        List<Guest> pending = guestRepository.findAllByCoupleId(coupleId).stream()
                .filter(g -> g.email() != null && !g.email().isBlank())
                .filter(g -> g.rsvpStatus() == GuestRsvpStatus.PENDING)
                .toList();
        // Skip unsubscribed/bounced/complained addresses (same rule as single sendInvite
        // and save-the-dates), batched so a big invite-all is two queries, not one per
        // guest. Silent here since this is a bulk action.
        Set<String> suppressedHashes = suppressionService.reasonsByHash(coupleId,
                pending.stream().map(g -> EmailSuppressionService.emailHash(g.email())).toList()).keySet();
        List<Guest> notSuppressed = pending.stream()
                .filter(g -> !suppressedHashes.contains(EmailSuppressionService.emailHash(g.email())))
                .toList();
        // Pre-filter guests already at the invite-send cap. issueInvite throws when a guest is
        // over the cap, and this method is @Transactional, so a single over-cap guest mid-loop
        // would roll back every earlier invite and return 500, then a retry would re-send to
        // everyone. Skipping over-cap guests up front keeps the batch a clean partial success.
        List<Guest> toInvite = notSuppressed.stream()
                .filter(g -> (g.inviteSendCount() != null ? g.inviteSendCount() : 0) < MAX_INVITE_SENDS)
                .toList();
        // Over-cap skips are working-as-designed (a couple re-running invite-all after guests
        // already hit the cap), not an anomaly, so this is INFO, not WARN. Counted and logged
        // in aggregate (one line, not per guest) to keep App Insights cost flat.
        int overCapSkipped = notSuppressed.size() - toInvite.size();
        if (overCapSkipped > 0) {
            log.info("invite-all skipped over-cap guests, coupleId={}, skippedCount={}",
                     coupleId, overCapSkipped);
        }

        log.info("invite-all batch started, coupleId={}, eligibleCount={}", coupleId, toInvite.size());
        for (Guest guest : toInvite) {
            issueInvite(guest, coupleId);
        }
        return toInvite.size();
    }

    /**
     * Public "find your invitation" search. Given a wedding slug and a partial name,
     * returns up to 5 matching guests with masked names and short-lived (1-hour) RSVP tokens.
     * Issues fresh tokens without revoking existing email-invite tokens so the emailed link
     * continues to work alongside the one returned here.
     *
     * This endpoint is unauthenticated, so it is hardened against table-bloat abuse: a
     * too-short query is rejected before any DB work OR captcha call, and once a query
     * is long enough to matter a Turnstile captcha token must verify before any DB work
     * runs (issue #89 -- the only endpoint that mints a live RSVP capability token from
     * a bare name guess). A matched guest who already holds a valid search token has
     * that single row rotated in place (new hash, refreshed expiry) instead of having a
     * brand-new row minted on every name guess.
     */
    @Transactional
    public List<com.altarwed.application.dto.RsvpFindResult> findGuestsByName(
            String slug, String name, String captchaToken, String remoteIp) {
        // Reject too-short queries before touching the database OR the captcha provider,
        // so a trivially-rejectable guess cannot be used to spam Cloudflare's API either.
        if (name == null || name.trim().length() < MIN_SEARCH_QUERY_LENGTH) {
            return List.of();
        }
        if (!captchaVerificationPort.verify(captchaToken, remoteIp)) {
            throw new CaptchaVerificationFailedException();
        }

        var website = websiteRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalArgumentException("Wedding not found"));
        if (!website.isPublished()) {
            throw new IllegalArgumentException("Wedding not found");
        }

        List<Guest> matches = guestRepository
                .findByCoupleIdAndNameContaining(website.coupleId(), name.trim())
                .stream()
                .limit(5)
                .toList();

        return matches.stream()
                .map(g -> {
                    String rawToken = UUID.randomUUID().toString();
                    // Reuse the guest's existing valid search-token row when present: rotate its
                    // hash and expiry in place rather than inserting a new row, so repeated name
                    // searches stay bounded to one search token per guest. Email-invite tokens are
                    // never matched here, so the emailed link is left intact.
                    UUID existingTokenId = tokenRepository
                            .findValidSearchToken(g.id(), LocalDateTime.now())
                            .map(RsvpInviteToken::id)
                            .orElse(null);
                    RsvpInviteToken searchToken = new RsvpInviteToken(
                            existingTokenId, hash(rawToken), g.id(),
                            LocalDateTime.now().plusHours(SEARCH_TOKEN_EXPIRY_HOURS),
                            false, null, RsvpInviteToken.SOURCE_SEARCH
                    );
                    tokenRepository.save(searchToken);
                    return new com.altarwed.application.dto.RsvpFindResult(maskName(g.name()), rawToken);
                })
                .toList();
    }

    // Public, called from the Next.js RSVP page with no auth
    // Dedicated seating assignment, always sets tableNumber to the given value,
    // including null (unassign). The general updateGuest method cannot do this
    // because its null-means-not-provided merge pattern cannot clear a field.
    @Transactional
    public Guest assignTable(UUID coupleId, UUID guestId, Integer tableNumber) {
        Guest existing = getGuest(coupleId, guestId);
        log.info("table assignment updated, guestId={}, coupleId={}, tableNumber={}", guestId, coupleId, tableNumber);
        Guest updated = new Guest(
                existing.id(), existing.coupleId(), existing.name(), existing.email(), existing.phone(),
                existing.rsvpStatus(), existing.plusOneAllowed(), existing.plusOneName(),
                existing.dietaryRestrictions(), existing.songRequest(),
                tableNumber,                    // always set, null means unassign
                existing.side(), existing.notes(),
                existing.mailLine1(), existing.mailCity(), existing.mailState(), existing.mailZip(), existing.mailCountry(),
                existing.noteForCouple(), existing.inviteSendCount(),
                existing.inviteSentAt(), existing.saveTheDateSentAt(), existing.respondedAt(), existing.remindAt(),
                existing.createdAt(), LocalDateTime.now(),
                existing.partyId(), existing.partyName(), existing.partyContact(),
                existing.sheetSyncId(), existing.syncedFromSheet()
        );
        return guestRepository.save(updated);
    }

    @Transactional(readOnly = true)
    public RsvpPageDataResponse getRsvpPageData(String rawToken) {
        RsvpInviteToken token = resolveToken(rawToken);
        Guest guest = guestRepository.findById(token.guestId())
                .orElseThrow(() -> new InvalidRsvpTokenException());

        var website = websiteRepository.findByCoupleId(guest.coupleId()).orElse(null);
        var couple  = coupleRepository.findById(guest.coupleId()).orElse(null);

        String coupleNames = couple != null
                ? couple.partnerTwoName() + " & " + couple.partnerOneName()
                : "The Couple";
        String weddingDate = (website != null && website.weddingDate() != null)
                ? website.weddingDate().format(DateTimeFormatter.ofPattern("MMMM d, yyyy"))
                : null;

        // If guest belongs to a party, load other members so the RSVP page can
        // show per-member toggles. Exclude the token holder from this list.
        List<com.altarwed.application.dto.PartyMemberInfo> partyMembers = null;
        String partyName = null;
        if (guest.partyId() != null) {
            partyName = guest.partyName();
            partyMembers = guestRepository.findAllByPartyId(guest.partyId()).stream()
                    .filter(m -> !m.id().equals(guest.id()))
                    .map(m -> new com.altarwed.application.dto.PartyMemberInfo(
                            m.id(), m.name(),
                            m.rsvpStatus() != null ? m.rsvpStatus().name() : null,
                            m.dietaryRestrictions(), m.songRequest()))
                    .toList();
        }

        // Show the registry link on the RSVP confirmation only when the site is published
        // AND at least one registry URL has been configured. Otherwise the link would 404
        // (unpublished site) or land on an empty "Registry coming soon" page.
        boolean hasRegistry = website != null
                && website.isPublished()
                && (website.registryUrl1() != null || website.registryUrl2() != null || website.registryUrl3() != null);

        String currentStatus = guest.rsvpStatus() != null ? guest.rsvpStatus().name() : null;
        log.info("rsvp page data fetched, guestId={}, coupleId={}, hasRegistry={}, currentStatus={}",
                 guest.id(), guest.coupleId(), hasRegistry, currentStatus);

        return new RsvpPageDataResponse(
                guest.name(), coupleNames, weddingDate,
                website != null ? website.venueName() : null,
                website != null ? website.venueCity()  : null,
                website != null ? website.venueState() : null,
                guest.plusOneAllowed(),
                website != null ? website.slug() : null,
                hasRegistry,
                partyMembers,
                partyName,
                currentStatus,
                guest.plusOneName(),
                guest.dietaryRestrictions(),
                guest.songRequest(),
                guest.noteForCouple(),
                customRsvpQuestionService.activeForRsvp(guest.coupleId())
        );
    }

    // Public, guest submits their RSVP from the Next.js page
    @Transactional
    public void submitRsvp(SubmitRsvpRequest req) {
        RsvpInviteToken token = resolveToken(req.token());
        Guest guest = guestRepository.findById(token.guestId())
                .orElseThrow(() -> new InvalidRsvpTokenException());
        log.info("rsvp submission received, guestId={}, coupleId={}, status={}, remindInDays={}",
                 guest.id(), guest.coupleId(), req.status(), req.remindInDays());

        // When remindInDays is set, keep rsvpStatus PENDING and schedule a reminder.
        // If the guest chose ATTENDING or DECLINING, clear any previous reminder.
        LocalDateTime remindAt = (req.remindInDays() != null)
                ? LocalDateTime.now().plusDays(req.remindInDays())
                : null;

        Guest responded = new Guest(
                guest.id(), guest.coupleId(), guest.name(), guest.email(), guest.phone(),
                req.status(),
                guest.plusOneAllowed(),
                req.plusOneName()         != null ? req.plusOneName()         : guest.plusOneName(),
                req.dietaryRestrictions() != null ? req.dietaryRestrictions() : guest.dietaryRestrictions(),
                req.songRequest()         != null ? req.songRequest()         : guest.songRequest(),
                guest.tableNumber(), guest.side(), guest.notes(),
                guest.mailLine1(), guest.mailCity(), guest.mailState(), guest.mailZip(), guest.mailCountry(),
                req.noteForCouple()       != null ? req.noteForCouple()       : guest.noteForCouple(),
                guest.inviteSendCount(),
                guest.inviteSentAt(), guest.saveTheDateSentAt(), LocalDateTime.now(), remindAt,
                guest.createdAt(), LocalDateTime.now(),
                guest.partyId(), guest.partyName(), guest.partyContact(),
                guest.sheetSyncId(), guest.syncedFromSheet()
        );
        guestRepository.save(responded);

        // Save individual party member responses if provided. We validate that each
        // member actually belongs to the same party to prevent cross-party tampering.
        if (req.partyResponses() != null && !req.partyResponses().isEmpty() && guest.partyId() != null) {
            int savedMembers = 0;
            for (com.altarwed.application.dto.PartyMemberResponse mr : req.partyResponses()) {
                Guest member = guestRepository.findById(mr.guestId()).orElse(null);
                if (member == null) continue;
                // Security guard: the token holder can only RSVP for members of their own
                // party. A mismatch is a tampering attempt, so log it (WARN, per-item and
                // recoverable) rather than dropping it silently.
                if (!guest.partyId().equals(member.partyId())) {
                    log.warn("rsvp party member rejected, cross-party, guestId={}, memberId={}, partyId={}",
                            guest.id(), mr.guestId(), guest.partyId());
                    continue;
                }
                LocalDateTime memberRemindAt = (mr.remindInDays() != null)
                        ? LocalDateTime.now().plusDays(mr.remindInDays())
                        : null;
                Guest memberResponded = new Guest(
                        member.id(), member.coupleId(), member.name(), member.email(), member.phone(),
                        mr.status(), member.plusOneAllowed(), member.plusOneName(),
                        mr.dietaryRestrictions() != null ? mr.dietaryRestrictions() : member.dietaryRestrictions(),
                        mr.songRequest()         != null ? mr.songRequest()         : member.songRequest(),
                        member.tableNumber(), member.side(), member.notes(),
                        member.mailLine1(), member.mailCity(), member.mailState(), member.mailZip(), member.mailCountry(),
                        member.noteForCouple(), member.inviteSendCount(),
                        member.inviteSentAt(), member.saveTheDateSentAt(), LocalDateTime.now(), memberRemindAt,
                        member.createdAt(), LocalDateTime.now(),
                        member.partyId(), member.partyName(), member.partyContact(),
                        member.sheetSyncId(), member.syncedFromSheet()
                );
                guestRepository.save(memberResponded);
                savedMembers++;
            }
            log.info("rsvp party members saved, guestId={}, coupleId={}, count={}",
                    guest.id(), guest.coupleId(), savedMembers);
        }

        // Persist custom-question answers for this submission (household-level, stored
        // against the responding guest). Only when answers were submitted, so a "remind me"
        // deferral (which carries none) never wipes previously saved answers.
        if (req.customAnswers() != null) {
            customRsvpQuestionService.replaceAnswers(responded.coupleId(), responded.id(), req.customAnswers());
        }

        // Only mark the token used if the guest is actually responding (not just setting a reminder).
        // For reminders the token stays valid so they can still use the same link when reminded.
        if (req.remindInDays() == null) {
            tokenRepository.markUsed(hash(req.token()));

            // Recipient-initiated resubscribe (The Knot/Zola model): a guest actually
            // responding re-consents to this couple's wedding mail, so clear any unsubscribe
            // they had for THIS couple (and any legacy global voluntary opt-out). Gated to a
            // real response, NOT a "remind me later" deferral: deferring contact must not
            // resume it (and would re-trigger reminder emails). Never clears a global
            // bounce/complaint. This is the only way a guest comes back.
            if (responded.email() != null && !responded.email().isBlank()) {
                suppressionService.resubscribeOnRsvp(responded.coupleId(),
                        EmailSuppressionService.emailHash(responded.email()));
            }

            // Notify the couple asynchronously. We never let an email failure break the RSVP
            // submission -- the @Async executor absorbs any Resend API errors silently.
            coupleRepository.findById(responded.coupleId()).ifPresent(couple -> {
                String coupleNames = couple.partnerTwoName() + " & " + couple.partnerOneName();
                String dashboardUrl = "https://app.altarwed.com/dashboard/guests";
                asyncEmailService.sendRsvpNotificationToCouple(
                        couple.email(),
                        coupleNames,
                        responded.name(),
                        responded.rsvpStatus().name(),
                        responded.noteForCouple(),
                        dashboardUrl,
                        // Reply-To = the guest who just responded, so the couple can reply
                        // straight to them. Null if this guest has no email on file.
                        responded.email()
                );
            });
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    // Result of resolving a manually-entered party name. isNew is true when this is the
    // first guest in a brand-new party, so the caller can make them the party contact.
    private record PartyResolution(UUID partyId, boolean isNew) {}

    /**
     * Resolves the party for a manually-managed guest. An explicit partyId always wins
     * (treated as joining an existing party). Otherwise a non-blank partyName reuses the
     * partyId of any existing guest in this couple with the same (case-insensitive) party
     * name, so members land in one group, or mints a new UUID to start a fresh party
     * (isNew). A blank or absent party name means the guest is solo. Only queries when a
     * party name is present, so the common no-party add/update stays a single write.
     */
    private PartyResolution resolveParty(UUID coupleId, UUID providedPartyId, String partyName) {
        if (providedPartyId != null) return new PartyResolution(providedPartyId, false);
        if (partyName == null || partyName.isBlank()) return new PartyResolution(null, false);
        String norm = partyName.toLowerCase().trim();
        return guestRepository.findAllByCoupleId(coupleId).stream()
                .filter(g -> g.partyId() != null && g.partyName() != null
                        && g.partyName().toLowerCase().trim().equals(norm))
                .map(g -> new PartyResolution(g.partyId(), false))
                .findFirst()
                .orElseGet(() -> new PartyResolution(UUID.randomUUID(), true));
    }

    private Guest getGuest(UUID coupleId, UUID guestId) {
        Guest guest = guestRepository.findById(guestId)
                .orElseThrow(() -> new GuestNotFoundException(guestId.toString()));
        if (!guest.coupleId().equals(coupleId)) {
            throw new GuestNotFoundException(guestId.toString());
        }
        return guest;
    }

    private Guest issueInvite(Guest guest, UUID coupleId) {
        if (guest.email() == null || guest.email().isBlank()) {
            log.warn("invite rejected, guest has no email, guestId={}, coupleId={}", guest.id(), coupleId);
            throw new IllegalArgumentException("Guest has no email address");
        }
        int currentSends = guest.inviteSendCount() != null ? guest.inviteSendCount() : 0;
        if (currentSends >= MAX_INVITE_SENDS) {
            log.warn("invite rejected, max sends reached, guestId={}, coupleId={}, sends={}",
                     guest.id(), coupleId, currentSends);
            throw new IllegalArgumentException(
                "This guest has already received the maximum of " + MAX_INVITE_SENDS + " invites.");
        }

        // Invalidate any outstanding invite tokens before issuing a new one
        tokenRepository.deleteAllByGuestId(guest.id());

        String rawToken = UUID.randomUUID().toString();
        RsvpInviteToken token = new RsvpInviteToken(
                null, hash(rawToken), guest.id(),
                LocalDateTime.now().plusDays(INVITE_EXPIRY_DAYS),
                false, null, RsvpInviteToken.SOURCE_INVITE
        );
        tokenRepository.save(token);

        var website = websiteRepository.findByCoupleId(coupleId).orElse(null);
        var couple  = coupleRepository.findById(coupleId).orElse(null);

        String coupleNames = couple != null
                ? couple.partnerTwoName() + " & " + couple.partnerOneName()
                : "The Couple";
        String weddingDate = (website != null && website.weddingDate() != null)
                ? website.weddingDate().format(DateTimeFormatter.ofPattern("MMMM d, yyyy"))
                : "TBD";

        // Reply-To = this couple's own address so a guest hitting reply reaches their
        // inbox, not the shared from-address.
        String coupleReplyTo = couple != null ? couple.email() : null;
        asyncEmailService.sendRsvpInviteEmail(guest.email(), guest.name(), coupleNames, weddingDate, rawToken,
                guest.id(), coupleId, coupleReplyTo);
        log.info("rsvp invite queued, guestId={}, coupleId={}, sendNumber={}",
                 guest.id(), coupleId, currentSends + 1);

        Guest updated = new Guest(
                guest.id(), guest.coupleId(), guest.name(), guest.email(), guest.phone(),
                guest.rsvpStatus(), guest.plusOneAllowed(), guest.plusOneName(),
                guest.dietaryRestrictions(), guest.songRequest(),
                guest.tableNumber(), guest.side(), guest.notes(),
                guest.mailLine1(), guest.mailCity(), guest.mailState(), guest.mailZip(), guest.mailCountry(),
                guest.noteForCouple(), currentSends + 1,
                LocalDateTime.now(), guest.saveTheDateSentAt(), guest.respondedAt(),
                null, // clear remindAt, the reminder was just fulfilled
                guest.createdAt(), LocalDateTime.now(),
                guest.partyId(), guest.partyName(), guest.partyContact(),
                guest.sheetSyncId(), guest.syncedFromSheet()
        );
        return guestRepository.save(updated);
    }

    // token.source() (SEARCH vs INVITE) is intentionally NOT checked here. The discriminator
    // exists only so the find-search can rotate its own row in place; it is not a trust
    // boundary. Both kinds grant exactly the same capability: RSVP for that one guest. Do not
    // assume token-type isolation, none is enforced.
    private RsvpInviteToken resolveToken(String rawToken) {
        RsvpInviteToken token = tokenRepository.findByTokenHash(hash(rawToken))
                .orElseThrow(() -> {
                    log.warn("rsvp token rejected, reason=token not found");
                    return new InvalidRsvpTokenException();
                });
        if (!token.isValid()) {
            log.warn("rsvp token rejected, reason=token invalid or expired, guestId={}", token.guestId());
            throw new InvalidRsvpTokenException();
        }
        return token;
    }

    /**
     * Masks a guest name for the public find-invitation response.
     * "Jordan Aasman" → "Jordan A."   Single-word names are returned as-is.
     */
    private String maskName(String fullName) {
        if (fullName == null || fullName.isBlank()) return "Guest";
        String[] parts = fullName.trim().split("\\s+");
        if (parts.length == 1) return parts[0];
        return parts[0] + " " + parts[parts.length - 1].charAt(0) + ".";
    }

    private String hash(String value) {
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
