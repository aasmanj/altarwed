package com.altarwed.application.service;

import com.altarwed.application.dto.*;
import com.altarwed.domain.exception.GuestNotFoundException;
import com.altarwed.domain.exception.InvalidRsvpTokenException;
import com.altarwed.domain.model.*;
import com.altarwed.domain.port.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
public class GuestService {

    private static final int INVITE_EXPIRY_DAYS = 30;

    private final GuestRepository guestRepository;
    private final RsvpInviteTokenRepository tokenRepository;
    private final WeddingWebsiteRepository websiteRepository;
    private final CoupleRepository coupleRepository;
    private final AsyncEmailService emailPort;

    public GuestService(
            GuestRepository guestRepository,
            RsvpInviteTokenRepository tokenRepository,
            WeddingWebsiteRepository websiteRepository,
            CoupleRepository coupleRepository,
            AsyncEmailService emailPort
    ) {
        this.guestRepository = guestRepository;
        this.tokenRepository = tokenRepository;
        this.websiteRepository = websiteRepository;
        this.coupleRepository = coupleRepository;
        this.emailPort = emailPort;
    }

    @Transactional
    public Guest addGuest(UUID coupleId, CreateGuestRequest req) {
        Guest guest = new Guest(
                null, coupleId, req.name(), req.email(), req.phone(),
                GuestRsvpStatus.PENDING, req.plusOneAllowed(), null,
                req.dietaryRestrictions(), null, null, null,
                null, req.side(), req.notes(),
                null, null, LocalDateTime.now(), LocalDateTime.now()
        );
        return guestRepository.save(guest);
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
                req.email()              != null ? req.email()              : existing.email(),
                req.phone()              != null ? req.phone()              : existing.phone(),
                req.rsvpStatus()         != null ? req.rsvpStatus()         : existing.rsvpStatus(),
                req.plusOneAllowed()     != null ? req.plusOneAllowed()     : existing.plusOneAllowed(),
                req.plusOneName()        != null ? req.plusOneName()        : existing.plusOneName(),
                req.dietaryRestrictions()!= null ? req.dietaryRestrictions(): existing.dietaryRestrictions(),
                req.mealPreference()     != null ? req.mealPreference()     : existing.mealPreference(),
                req.songRequest()        != null ? req.songRequest()        : existing.songRequest(),
                req.shuttleNeeded()      != null ? req.shuttleNeeded()      : existing.shuttleNeeded(),
                req.tableNumber()        != null ? req.tableNumber()        : existing.tableNumber(),
                req.side()               != null ? req.side()               : existing.side(),
                req.notes()              != null ? req.notes()              : existing.notes(),
                existing.inviteSentAt(), existing.respondedAt(),
                existing.createdAt(), LocalDateTime.now()
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
        return issueInvite(guest, coupleId);
    }

    @Transactional
    public int sendSaveDates(UUID coupleId) {
        var website = websiteRepository.findByCoupleId(coupleId).orElse(null);
        var couple  = coupleRepository.findById(coupleId).orElse(null);
        String coupleNames = couple != null
                ? couple.partnerOneName() + " & " + couple.partnerTwoName()
                : "The Couple";
        String weddingDate = (website != null && website.weddingDate() != null)
                ? website.weddingDate().format(java.time.format.DateTimeFormatter.ofPattern("MMMM d, yyyy"))
                : "TBD";
        String weddingUrl = website != null
                ? "https://www.altarwed.com/wedding/" + website.slug()
                : "https://www.altarwed.com";

        List<Guest> toSend = guestRepository.findAllByCoupleId(coupleId).stream()
                .filter(g -> g.email() != null && !g.email().isBlank())
                .toList();

        for (Guest guest : toSend) {
            emailPort.sendSaveTheDateEmail(guest.email(), guest.name(), coupleNames, weddingDate, weddingUrl);
        }
        return toSend.size();
    }

    @Transactional
    public int sendAllPendingInvites(UUID coupleId) {
        List<Guest> toInvite = guestRepository.findAllByCoupleId(coupleId).stream()
                .filter(g -> g.email() != null && !g.email().isBlank())
                .filter(g -> g.rsvpStatus() == GuestRsvpStatus.PENDING)
                .toList();

        for (Guest guest : toInvite) {
            issueInvite(guest, coupleId);
        }
        return toInvite.size();
    }

    // Public — called from the Next.js RSVP page with no auth
    @Transactional(readOnly = true)
    public RsvpPageDataResponse getRsvpPageData(String rawToken) {
        RsvpInviteToken token = resolveToken(rawToken);
        Guest guest = guestRepository.findById(token.guestId())
                .orElseThrow(() -> new InvalidRsvpTokenException());

        var website = websiteRepository.findByCoupleId(guest.coupleId()).orElse(null);
        var couple  = coupleRepository.findById(guest.coupleId()).orElse(null);

        String coupleNames = couple != null
                ? couple.partnerOneName() + " & " + couple.partnerTwoName()
                : "The Couple";
        String weddingDate = (website != null && website.weddingDate() != null)
                ? website.weddingDate().format(DateTimeFormatter.ofPattern("MMMM d, yyyy"))
                : null;

        return new RsvpPageDataResponse(
                guest.name(), coupleNames, weddingDate,
                website != null ? website.venueName() : null,
                website != null ? website.venueCity()  : null,
                website != null ? website.venueState() : null,
                guest.plusOneAllowed()
        );
    }

    // Public — guest submits their RSVP from the Next.js page
    @Transactional
    public void submitRsvp(SubmitRsvpRequest req) {
        RsvpInviteToken token = resolveToken(req.token());
        Guest guest = guestRepository.findById(token.guestId())
                .orElseThrow(() -> new InvalidRsvpTokenException());

        Guest responded = new Guest(
                guest.id(), guest.coupleId(), guest.name(), guest.email(), guest.phone(),
                req.status(),
                guest.plusOneAllowed(),
                req.plusOneName()         != null ? req.plusOneName()         : guest.plusOneName(),
                req.dietaryRestrictions() != null ? req.dietaryRestrictions() : guest.dietaryRestrictions(),
                req.mealPreference()      != null ? req.mealPreference()      : guest.mealPreference(),
                req.songRequest()         != null ? req.songRequest()         : guest.songRequest(),
                req.shuttleNeeded()       != null ? req.shuttleNeeded()       : guest.shuttleNeeded(),
                guest.tableNumber(), guest.side(), guest.notes(),
                guest.inviteSentAt(), LocalDateTime.now(),
                guest.createdAt(), LocalDateTime.now()
        );
        guestRepository.save(responded);
        tokenRepository.markUsed(hash(req.token()));
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
            throw new IllegalArgumentException("Guest has no email address");
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
                ? couple.partnerOneName() + " & " + couple.partnerTwoName()
                : "The Couple";
        String weddingDate = (website != null && website.weddingDate() != null)
                ? website.weddingDate().format(DateTimeFormatter.ofPattern("MMMM d, yyyy"))
                : "TBD";

        emailPort.sendRsvpInviteEmail(guest.email(), guest.name(), coupleNames, weddingDate, rawToken);

        Guest updated = new Guest(
                guest.id(), guest.coupleId(), guest.name(), guest.email(), guest.phone(),
                guest.rsvpStatus(), guest.plusOneAllowed(), guest.plusOneName(),
                guest.dietaryRestrictions(), guest.mealPreference(), guest.songRequest(), guest.shuttleNeeded(),
                guest.tableNumber(), guest.side(), guest.notes(),
                LocalDateTime.now(), guest.respondedAt(),
                guest.createdAt(), LocalDateTime.now()
        );
        return guestRepository.save(updated);
    }

    private RsvpInviteToken resolveToken(String rawToken) {
        RsvpInviteToken token = tokenRepository.findByTokenHash(hash(rawToken))
                .orElseThrow(InvalidRsvpTokenException::new);
        if (!token.isValid()) throw new InvalidRsvpTokenException();
        return token;
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
