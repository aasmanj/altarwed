package com.altarwed.application.service;

import com.altarwed.application.dto.*;
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

    private final GuestRepository guestRepository;
    private final RsvpInviteTokenRepository tokenRepository;
    private final WeddingWebsiteRepository websiteRepository;
    private final CoupleRepository coupleRepository;
    private final AsyncEmailService asyncEmailService;
    private final EmailSuppressionService suppressionService;

    public GuestService(
            GuestRepository guestRepository,
            RsvpInviteTokenRepository tokenRepository,
            WeddingWebsiteRepository websiteRepository,
            CoupleRepository coupleRepository,
            AsyncEmailService asyncEmailService,
            EmailSuppressionService suppressionService
    ) {
        this.guestRepository = guestRepository;
        this.tokenRepository = tokenRepository;
        this.websiteRepository = websiteRepository;
        this.coupleRepository = coupleRepository;
        this.asyncEmailService = asyncEmailService;
        this.suppressionService = suppressionService;
    }

    @Transactional
    public List<Guest> addGuestsBulk(UUID coupleId, List<com.altarwed.application.dto.CreateGuestRequest> reqs) {
        List<Guest> guests = reqs.stream().map(req -> new Guest(
                null, coupleId, req.name(), req.email(), req.phone(),
                GuestRsvpStatus.PENDING, req.plusOneAllowed(), null,
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
        Guest guest = new Guest(
                null, coupleId, req.name(), req.email(), req.phone(),
                GuestRsvpStatus.PENDING, req.plusOneAllowed(), null,
                req.dietaryRestrictions(), null,
                null, req.side(), req.notes(),
                req.mailLine1(), req.mailCity(), req.mailState(), req.mailZip(), req.mailCountry(),
                null, 0,
                null, null, null, null, LocalDateTime.now(), LocalDateTime.now(),
                req.partyId(), req.partyName(),
                req.partyContact() != null ? req.partyContact() : false,
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
                    GuestRsvpStatus.PENDING, m.plusOneAllowed(), null,
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
                req.partyId()    != null ? req.partyId()    : existing.partyId(),
                req.partyName()  != null ? req.partyName()  : existing.partyName(),
                req.partyContact()!= null ? req.partyContact(): existing.partyContact(),
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
        List<Guest> toInvite = pending.stream()
                .filter(g -> !suppressedHashes.contains(EmailSuppressionService.emailHash(g.email())))
                .toList();

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
     */
    @Transactional
    public List<com.altarwed.application.dto.RsvpFindResult> findGuestsByName(String slug, String name) {
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
                    RsvpInviteToken searchToken = new RsvpInviteToken(
                            null, hash(rawToken), g.id(),
                            LocalDateTime.now().plusHours(1),
                            false, null
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
                    .map(m -> new com.altarwed.application.dto.PartyMemberInfo(m.id(), m.name()))
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
                guest.noteForCouple()
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
            for (com.altarwed.application.dto.PartyMemberResponse mr : req.partyResponses()) {
                guestRepository.findById(mr.guestId()).ifPresent(member -> {
                    if (!guest.partyId().equals(member.partyId())) return; // security guard
                    LocalDateTime memberRemindAt = (mr.remindInDays() != null)
                            ? LocalDateTime.now().plusDays(mr.remindInDays())
                            : null;
                    Guest memberResponded = new Guest(
                            member.id(), member.coupleId(), member.name(), member.email(), member.phone(),
                            mr.status(), member.plusOneAllowed(), member.plusOneName(),
                            member.dietaryRestrictions(), member.songRequest(),
                            member.tableNumber(), member.side(), member.notes(),
                            member.mailLine1(), member.mailCity(), member.mailState(), member.mailZip(), member.mailCountry(),
                            member.noteForCouple(), member.inviteSendCount(),
                            member.inviteSentAt(), member.saveTheDateSentAt(), LocalDateTime.now(), memberRemindAt,
                            member.createdAt(), LocalDateTime.now(),
                            member.partyId(), member.partyName(), member.partyContact(),
                            member.sheetSyncId(), member.syncedFromSheet()
                    );
                    guestRepository.save(memberResponded);
                });
            }
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
                        dashboardUrl
                );
            });
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

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
                false, null
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
