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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class GuestService {

    private static final Logger log = LoggerFactory.getLogger(GuestService.class);
    // RSVP invite tokens expire relative to the couple's wedding date, not a fixed window after
    // send (issue #216). Invites go out 6 to 8 weeks ahead and most guests respond in the final
    // weeks, so a fixed 30-day expiry killed the emailed link for late responders. Expiry =
    // wedding date + this grace (end of that day) so the link stays valid through the weekend.
    private static final int INVITE_EXPIRY_GRACE_DAYS_AFTER_WEDDING = 3;
    // Couple has not set a wedding date yet: fall back to a long window so the link does not die.
    private static final int INVITE_EXPIRY_NO_DATE_DAYS = 365;
    // Floor: never issue a token that expires sooner than this, even when the wedding is tomorrow
    // (or already past), so a couple sending invites late still gets a usable link.
    private static final int INVITE_EXPIRY_FLOOR_DAYS = 30;
    // Public so RsvpReminderService can exclude at-cap guests from its due-reminder query
    // (issue #233) using the same source of truth this service enforces, with no risk of a
    // hardcoded copy drifting.
    public static final int MAX_INVITE_SENDS = 3;
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
    private final SaveTheDateSendRepository saveTheDateSendRepository;
    private final RsvpInviteBulkSendRepository rsvpInviteBulkSendRepository;

    public GuestService(
            GuestRepository guestRepository,
            RsvpInviteTokenRepository tokenRepository,
            WeddingWebsiteRepository websiteRepository,
            CoupleRepository coupleRepository,
            AsyncEmailService asyncEmailService,
            EmailSuppressionService suppressionService,
            CustomRsvpQuestionService customRsvpQuestionService,
            CaptchaVerificationPort captchaVerificationPort,
            SaveTheDateSendRepository saveTheDateSendRepository,
            RsvpInviteBulkSendRepository rsvpInviteBulkSendRepository
    ) {
        this.guestRepository = guestRepository;
        this.tokenRepository = tokenRepository;
        this.websiteRepository = websiteRepository;
        this.coupleRepository = coupleRepository;
        this.asyncEmailService = asyncEmailService;
        this.suppressionService = suppressionService;
        this.customRsvpQuestionService = customRsvpQuestionService;
        this.captchaVerificationPort = captchaVerificationPort;
        this.saveTheDateSendRepository = saveTheDateSendRepository;
        this.rsvpInviteBulkSendRepository = rsvpInviteBulkSendRepository;
    }

    @Transactional
    public List<Guest> addGuestsBulk(UUID coupleId, List<com.altarwed.application.dto.CreateGuestRequest> reqs) {
        List<Guest> guests = reqs.stream().map(req -> new Guest(
                null, coupleId, req.name(), req.email(), req.phone(),
                req.rsvpStatus() != null ? req.rsvpStatus() : GuestRsvpStatus.PENDING,
                Boolean.TRUE.equals(req.plusOneAllowed()),
                req.plusOneName() != null && !req.plusOneName().isBlank() ? req.plusOneName() : null,
                req.dietaryRestrictions(), null,
                req.tableNumber(), req.side(), req.notes(),
                req.mailLine1(), req.mailCity(), req.mailState(), req.mailZip(), req.mailCountry(),
                null, 0,
                null, null, null, null, LocalDateTime.now(), LocalDateTime.now(),
                req.partyId(), req.partyName(),
                req.partyContact() != null ? req.partyContact() : false,
                null, false  // sheetSyncId, syncedFromSheet: manually added guest
        )).toList();
        List<Guest> saved = guestRepository.saveAll(guests);
        log.info("guest bulk import saved, coupleId={}, count={}", coupleId, saved.size());
        return saved;
    }

    @Transactional
    public Guest addGuest(UUID coupleId, CreateGuestRequest req) {
        PartyResolution party = resolveParty(coupleId, req.partyId(), req.partyName());
        Guest guest = new Guest(
                null, coupleId, req.name(), req.email(), req.phone(),
                req.rsvpStatus() != null ? req.rsvpStatus() : GuestRsvpStatus.PENDING,
                Boolean.TRUE.equals(req.plusOneAllowed()),
                req.plusOneName() != null && !req.plusOneName().isBlank() ? req.plusOneName() : null,
                req.dietaryRestrictions(), null,
                req.tableNumber(), req.side(), req.notes(),
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
                    m.rsvpStatus() != null ? m.rsvpStatus() : GuestRsvpStatus.PENDING,
                    Boolean.TRUE.equals(m.plusOneAllowed()),
                    m.plusOneName() != null && !m.plusOneName().isBlank() ? m.plusOneName() : null,
                    m.dietaryRestrictions(), null,
                    m.tableNumber(), m.side(), m.notes(),
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

    // Canonical guest-export column order (issue #253). This is the SAME header set and order
    // the frontend import template emits (GuestListPage.tsx GUEST_SHEET_COLUMNS) so a downloaded
    // CSV round-trips straight back through the spreadsheet importer (guestImport.ts HEADER_MAP
    // matches these headers case-insensitively) and the Google Sheet sync. Keep this in lockstep
    // with that list: renaming a header here without renaming it there breaks the round-trip.
    // The three columns AltarWed manages internally (Plus One Name, RSVP Status, Table #) are
    // included so the export is a complete snapshot; the importer intentionally ignores them.
    static final String[] GUEST_EXPORT_HEADERS = {
            "Guest Name(s)", "Party", "Side (Bride or Groom)", "Phone Number", "Email Address",
            "Street Address", "City", "State", "Zip Code", "Country",
            "Allowed Plus One?", "Plus One Name", "RSVP Status", "Table #",
            "Dietary Restriction", "Notes"
    };

    // RFC 4180 record separator. SheetJS (the importer) and Excel both accept CRLF.
    private static final String CSV_NEWLINE = "\r\n";

    /**
     * Serializes this couple's full guest list to a CSV string for the self-serve data export
     * (issue #253). Columns mirror the import template exactly (see {@link #GUEST_EXPORT_HEADERS})
     * so what a couple exports they can re-import. A UTF-8 BOM is prepended so Excel opens
     * non-ASCII names and international addresses correctly, matching the frontend's own export.
     *
     * Read-only and couple-scoped: the caller (CoupleExportController) has already asserted
     * ownership via CoupleAccessGuard, and this only ever reads guests belonging to {@code coupleId}.
     */
    @Transactional(readOnly = true)
    public String exportGuestsCsv(UUID coupleId) {
        List<Guest> guests = guestRepository.findAllByCoupleId(coupleId);
        StringBuilder sb = new StringBuilder();
        sb.append('\uFEFF'); // UTF-8 BOM so Excel detects UTF-8 (matches the frontend export)

        sb.append(csvRow(GUEST_EXPORT_HEADERS));
        for (Guest g : guests) {
            sb.append(csvRow(new String[]{
                    g.name(),
                    g.partyName(),
                    g.side() != null ? g.side().name() : null,
                    g.phone(),
                    g.email(),
                    g.mailLine1(),
                    g.mailCity(),
                    g.mailState(),
                    g.mailZip(),
                    g.mailCountry(),
                    g.plusOneAllowed() ? "Yes" : "No",
                    g.plusOneName(),
                    g.rsvpStatus() != null ? g.rsvpStatus().name() : null,
                    g.tableNumber() != null ? String.valueOf(g.tableNumber()) : null,
                    g.dietaryRestrictions(),
                    g.notes()
            }));
        }
        // Aggregate audit line (no PII): supports the GDPR/CCPA access-request trail without
        // logging any guest field. One line per export, not per guest (observability rule 9).
        log.info("guest list exported, coupleId={}, guestCount={}", coupleId, guests.size());
        return sb.toString();
    }

    // Builds one CSV record (fields joined by commas, terminated by CRLF), escaping each field
    // per RFC 4180: a field containing a comma, double-quote, or newline is wrapped in quotes and
    // its inner quotes are doubled. Null fields render as empty.
    private static String csvRow(String[] fields) {
        StringBuilder row = new StringBuilder();
        for (int i = 0; i < fields.length; i++) {
            if (i > 0) row.append(',');
            row.append(csvEscape(fields[i]));
        }
        row.append(CSV_NEWLINE);
        return row.toString();
    }

    private static String csvEscape(String value) {
        if (value == null || value.isEmpty()) return "";
        String s = value;
        // Neutralize CSV/formula injection before RFC-4180 quoting. A guest controls free-text
        // fields (dietary, notes, plus-one name) via the public RSVP endpoint; a value beginning
        // with a formula trigger (= + - @ tab CR) would execute in Excel/Sheets when the couple
        // opens the export, enabling local code exec (legacy DDE) or exfiltration of adjacent
        // cells. Prefixing a single quote forces spreadsheet apps to treat it as literal text.
        // One-way on export only (issue #253 scope excludes the import path), so a re-imported
        // cell keeps a literal leading apostrophe -- an accepted security-over-round-trip trade.
        char c0 = s.charAt(0);
        if (c0 == '=' || c0 == '+' || c0 == '-' || c0 == '@' || c0 == '\t' || c0 == '\r') {
            s = "'" + s;
        }
        if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0
                || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0) {
            return '"' + s.replace("\"", "\"\"") + '"';
        }
        return s;
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

    /**
     * Reminder-scheduler entry point for re-sending a deferred ("remind me later") RSVP invite.
     *
     * Identical to {@link #sendInvite} except for the invite-cap branch, and that difference is
     * the whole point of the method (issue #233). A couple-initiated send that hits the cap
     * throws so the couple sees the rejection. A reminder-driven send that hits the cap must NOT
     * throw and be retried forever: issueInvite throws at the cap check before it can clear
     * remind_at, sendDueReminders catches and continues, and the same guest re-qualifies for
     * findDueReminders every hour until the wedding. So at the cap we clear remind_at and return
     * without sending, dropping the guest out of the reminder query permanently. This is the belt
     * to findDueReminders' suspenders: that query already excludes at-cap guests, and this clears
     * any that still reach here (e.g. a guest who crossed the cap on a couple-initiated send
     * between the poll and this call).
     */
    @Transactional
    public void sendReminderInvite(UUID coupleId, UUID guestId) {
        Guest guest = getGuest(coupleId, guestId);
        int currentSends = guest.inviteSendCount() != null ? guest.inviteSendCount() : 0;
        if (currentSends >= MAX_INVITE_SENDS) {
            log.info("rsvp reminder cleared, guest at invite cap, guestId={}, coupleId={}, sends={}",
                     guestId, coupleId, currentSends);
            guestRepository.save(withRemindAtCleared(guest));
            return;
        }
        // Below the cap: the normal single-send path (unsubscribe honoured, token issued, cap
        // incremented, remind_at cleared by issueInvite on success).
        sendInvite(coupleId, guestId);
    }

    // @Transactional is load-bearing, not decorative: markSaveTheDatesSent (below) is a
    // @Modifying JPQL UPDATE with no transaction of its own (GuestJpaRepository), so it needs an
    // ambient transaction or JPA throws TransactionRequiredException. Do NOT "simplify" this
    // annotation away. Its presence is also exactly why the key claim needs REQUIRES_NEW +
    // saveAndFlush (see the claim block below) to run and fail in isolation.
    @Transactional
    public SaveTheDateSendResult sendSaveDates(UUID coupleId, List<UUID> guestIds, String idempotencyKey) {
        log.info("save-the-date send batch started, coupleId={}, targetCount={}", coupleId,
                guestIds == null ? "all" : guestIds.size());

        // Idempotency guard (issue #232): a send whose HTTP response was lost gets retried by the
        // couple carrying the same client-generated key. If a receipt already exists for this key,
        // return its stored summary instead of emailing and re-stamping the batch a second time.
        // Same concept as PrintOrderService.createOrder's replay check; the storage mechanism
        // differs (see the claim block below).
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<SaveTheDateSend> replay =
                    saveTheDateSendRepository.findByCoupleIdAndIdempotencyKey(coupleId, idempotencyKey);
            if (replay.isPresent()) {
                SaveTheDateSend r = replay.get();
                log.info("save-the-date send idempotent replay, returning existing, coupleId={}, sendId={}",
                        coupleId, r.id());
                return new SaveTheDateSendResult(
                        r.queuedCount(), r.invalidCount(), r.suppressedCount(), List.of(), true);
            }
        }

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

        // Claim the idempotency key BEFORE the email fan-out and the stamp: two concurrent submits
        // with the same key both reach here having each seen no receipt above, but the unique index
        // lets exactly one insert win. The loser's saveAndFlush throws DataIntegrityViolationException
        // and we replay the winner's summary rather than mailing the batch twice. The receipt commits
        // ahead of the async send; a retry that lands after the send was enqueued but before its
        // stamp committed correctly replays instead of re-sending.
        //
        // Same idea as PrintOrderService.createOrder, but NOT the same mechanism, so do not predict
        // one from the other: createOrder is deliberately NOT @Transactional, so its claim already
        // runs alone in its own Spring Data transaction that flushes at method return. sendSaveDates
        // runs inside this method's ambient @Transactional (required for the stamp above), so the
        // claim MUST be forced into its own transaction that fails in isolation, hence the adapter's
        // REQUIRES_NEW + saveAndFlush. Without that, the collision would surface at the outer commit
        // (a raw 500, not a replay) and would poison the ambient transaction we still need.
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            try {
                saveTheDateSendRepository.save(new SaveTheDateSend(
                        null, coupleId, idempotencyKey,
                        queueable.size(), invalid.size(), suppressedCount, LocalDateTime.now()));
            } catch (DataIntegrityViolationException race) {
                log.warn("save-the-date send idempotency race, returning concurrent summary, coupleId={}", coupleId);
                SaveTheDateSend r = saveTheDateSendRepository
                        .findByCoupleIdAndIdempotencyKey(coupleId, idempotencyKey)
                        .orElseThrow(() -> race);
                return new SaveTheDateSendResult(
                        r.queuedCount(), r.invalidCount(), r.suppressedCount(), List.of(), true);
            }
        }

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
        return new SaveTheDateSendResult(queueable.size(), invalid.size(), suppressedCount, invalid, false);
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
        // Preload the couple + website once (identical for every guest) and mint each invite into
        // one outbox, then fan the whole list out through a single batched Resend call (issue
        // #378). Guarded on a non-empty list so an all-over-cap run issues no extra queries.
        if (!toInvite.isEmpty()) {
            WeddingWebsite website = websiteRepository.findByCoupleId(coupleId).orElse(null);
            Couple couple = coupleRepository.findById(coupleId).orElse(null);
            List<RsvpInviteRecipient> outbox = new ArrayList<>();
            for (Guest guest : toInvite) {
                issueInviteToBatch(guest, coupleId, website, outbox);
            }
            dispatchBatchInvites(outbox, coupleId, website, couple);
        }
        return toInvite.size();
    }

    /**
     * Bulk RSVP invite send for an explicit, couple-selected list of guest ids.
     *
     * Ownership is all-or-nothing: if ANY requested id is not one of this couple's
     * guests the whole request is rejected with 403 (AccessDeniedException) before a
     * single invite is issued, so a crafted body cannot invite (and thereby confirm the
     * existence of) another couple's guests. This is stricter than a per-guest skip on
     * purpose: a foreign id is an IDOR probe, not an ineligible guest.
     *
     * For guests that do belong to the couple, the skip rules are applied server-side and
     * reported (never thrown) so one ineligible guest never fails the batch:
     *   - no email address            -> skipped "no_email"
     *   - already responded (not PENDING) -> skipped "already_responded"
     *   - at the invite-send cap ({@value #MAX_INVITE_SENDS}) -> skipped "cap_reached"
     *   - unsubscribed/bounced/complained -> skipped "unsubscribed" (same opt-out honoured
     *     by the single sendInvite and the invite-all paths; a bulk action must not become a
     *     loophole that emails someone who opted out)
     * Everyone else is invited via the same issueInvite path as the single send, so token
     * issuance, cap increment, and email queuing stay in one place.
     */
    @Transactional
    public BulkInviteResult sendInvitesBulk(UUID coupleId, List<UUID> guestIds, String idempotencyKey) {
        log.info("bulk invite send batch started, coupleId={}, targetCount={}", coupleId, guestIds.size());

        // Idempotency guard (issue #295): a send whose HTTP response was lost gets retried by
        // the couple carrying the same client-generated key. If a receipt already exists for
        // this key, return its stored summary instead of emailing and re-incrementing send
        // counts a second time. Same mechanism as sendSaveDates (issue #232); see that method
        // and RsvpInviteBulkSendJpaAdapter for why the claim below is REQUIRES_NEW + flush.
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<RsvpInviteBulkSend> replay =
                    rsvpInviteBulkSendRepository.findByCoupleIdAndIdempotencyKey(coupleId, idempotencyKey);
            if (replay.isPresent()) {
                RsvpInviteBulkSend r = replay.get();
                log.info("bulk invite send idempotent replay, returning existing, coupleId={}, sendId={}",
                        coupleId, r.id());
                return new BulkInviteResult(r.sentCount(), r.skippedCount(), List.of(), true);
            }
        }

        Map<UUID, Guest> byId = new HashMap<>();
        for (Guest g : guestRepository.findAllByCoupleId(coupleId)) {
            byId.put(g.id(), g);
        }

        // Reject the whole request if any id is not this couple's guest (IDOR). 403, not a
        // per-guest skip, and before any invite is issued so nothing is partially processed.
        for (UUID id : guestIds) {
            if (!byId.containsKey(id)) {
                log.warn("bulk invite rejected, reason=idor, coupleId={}, targetGuestId={}", coupleId, id);
                throw new AccessDeniedException("Access denied");
            }
        }

        // Preserve the caller's order, de-duplicate ids (a repeated id must not send twice).
        List<Guest> requested = new ArrayList<>();
        Set<UUID> seen = new HashSet<>();
        for (UUID id : guestIds) {
            if (seen.add(id)) {
                requested.add(byId.get(id));
            }
        }

        // Batch the suppression lookup for the addresses in play (one global + one per-couple
        // query) instead of an existence check per guest, matching the save-the-date path.
        Set<String> suppressedHashes = suppressionService.reasonsByHash(coupleId,
                requested.stream()
                        .filter(g -> g.email() != null && !g.email().isBlank())
                        .map(g -> EmailSuppressionService.emailHash(g.email()))
                        .toList()).keySet();

        List<BulkInviteResult.SkippedGuest> skipped = new ArrayList<>();
        List<Guest> toInvite = new ArrayList<>();
        for (Guest g : requested) {
            if (g.email() == null || g.email().isBlank()) {
                skipped.add(new BulkInviteResult.SkippedGuest(g.id(), g.name(), BulkInviteResult.REASON_NO_EMAIL));
            } else if (g.rsvpStatus() != GuestRsvpStatus.PENDING) {
                skipped.add(new BulkInviteResult.SkippedGuest(g.id(), g.name(), BulkInviteResult.REASON_ALREADY_RESPONDED));
            } else if ((g.inviteSendCount() != null ? g.inviteSendCount() : 0) >= MAX_INVITE_SENDS) {
                skipped.add(new BulkInviteResult.SkippedGuest(g.id(), g.name(), BulkInviteResult.REASON_CAP_REACHED));
            } else if (suppressedHashes.contains(EmailSuppressionService.emailHash(g.email()))) {
                skipped.add(new BulkInviteResult.SkippedGuest(g.id(), g.name(), BulkInviteResult.REASON_UNSUBSCRIBED));
            } else {
                toInvite.add(g);
            }
        }

        // Preload the couple + website once (identical for every guest) and pass them into
        // issueInvite so a large batch is two extra queries, not two per guest (N+1). Guarded
        // on a non-empty list so a send with nothing to invite issues no queries at all.
        // Claim the idempotency key BEFORE the invite fan-out (issue #295): two concurrent
        // submits with the same key both pass the replay check above, but the unique index
        // lets exactly one insert win; the loser catches the collision here and replays the
        // winner's summary rather than mailing the batch twice. The adapter forces the claim
        // into its own flushed transaction (REQUIRES_NEW + saveAndFlush) for the same reasons
        // documented on sendSaveDates: the collision must surface here as a catchable
        // DataIntegrityViolationException, and it must not doom this ambient transaction.
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            try {
                rsvpInviteBulkSendRepository.save(new RsvpInviteBulkSend(
                        null, coupleId, idempotencyKey,
                        toInvite.size(), skipped.size(), LocalDateTime.now()));
            } catch (DataIntegrityViolationException race) {
                log.warn("bulk invite send idempotency race, returning concurrent summary, coupleId={}", coupleId);
                RsvpInviteBulkSend r = rsvpInviteBulkSendRepository
                        .findByCoupleIdAndIdempotencyKey(coupleId, idempotencyKey)
                        .orElseThrow(() -> race);
                return new BulkInviteResult(r.sentCount(), r.skippedCount(), List.of(), true);
            }
        }

        //
        // Rollback window: the invites are queued on the emailExecutor (@Async) and are NOT
        // enrolled in this @Transactional method. If the transaction aborts partway through the
        // loop, the token/cap writes for earlier guests roll back but their already-queued
        // emails still go out. We accept that here for the same reason invite-all does (see the
        // over-cap note above): the cap check makes a re-run safe, so a partial send beats a
        // hard failure.
        if (!toInvite.isEmpty()) {
            WeddingWebsite website = websiteRepository.findByCoupleId(coupleId).orElse(null);
            Couple couple = coupleRepository.findById(coupleId).orElse(null);
            List<RsvpInviteRecipient> outbox = new ArrayList<>();
            for (Guest g : toInvite) {
                issueInviteToBatch(g, coupleId, website, outbox);
            }
            // One batched Resend call for the whole selection instead of one per guest (issue #378).
            dispatchBatchInvites(outbox, coupleId, website, couple);
        }

        log.info("bulk invite send batch queued, coupleId={}, sent={}, skipped={}",
                 coupleId, toInvite.size(), skipped.size());
        return new BulkInviteResult(toInvite.size(), skipped.size(), skipped, false);
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
        // Raw ISO date (yyyy-MM-dd from LocalDate.toString()) exposed alongside the display
        // string so the frontend can build a calendar event without re-parsing the localized
        // "MMMM d, yyyy" form. Null-safe: no website or no date yields null.
        String weddingDateIso = (website != null && website.weddingDate() != null)
                ? website.weddingDate().toString()
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
                weddingDateIso,
                website != null ? website.ceremonyTime() : null,
                website != null ? website.venueName() : null,
                website != null ? website.venueAddress() : null,
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

    // Rebuilds a guest with remind_at cleared and updated_at refreshed, leaving every other
    // field (including invite_send_count) untouched. Used only by the reminder path when an
    // at-cap guest must be dropped from the reminder query without issuing another invite.
    private Guest withRemindAtCleared(Guest g) {
        return new Guest(
                g.id(), g.coupleId(), g.name(), g.email(), g.phone(),
                g.rsvpStatus(), g.plusOneAllowed(), g.plusOneName(),
                g.dietaryRestrictions(), g.songRequest(),
                g.tableNumber(), g.side(), g.notes(),
                g.mailLine1(), g.mailCity(), g.mailState(), g.mailZip(), g.mailCountry(),
                g.noteForCouple(), g.inviteSendCount(),
                g.inviteSentAt(), g.saveTheDateSentAt(), g.respondedAt(),
                null, // clear remindAt so this guest can never re-qualify for a reminder
                g.createdAt(), LocalDateTime.now(),
                g.partyId(), g.partyName(), g.partyContact(),
                g.sheetSyncId(), g.syncedFromSheet()
        );
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
        // Single-invite entry point: load the couple + website for this one send, then
        // delegate. The bulk path preloads these once and calls issueInviteToBatch directly to
        // avoid re-querying them per guest (N+1).
        return issueInvite(guest, coupleId,
                websiteRepository.findByCoupleId(coupleId).orElse(null),
                coupleRepository.findById(coupleId).orElse(null));
    }

    // Package-private single-send overload taking a preloaded website/couple. Mints the token
    // (updating the guest) and fires exactly one Resend call for this recipient. The bulk paths
    // instead call issueInviteToBatch below to collect every recipient and fan them out in one
    // batched provider call (issue #378), so this single-call path is used only by the single
    // sendInvite / reminder flow.
    Guest issueInvite(Guest guest, UUID coupleId, WeddingWebsite website, Couple couple) {
        MintedInvite minted = mintInvite(guest, coupleId, website);
        // Reply-To = this couple's own address so a guest hitting reply reaches their
        // inbox, not the shared from-address.
        asyncEmailService.sendRsvpInviteEmail(guest.email(), guest.name(),
                inviteCoupleNames(couple), inviteWeddingDate(website), minted.rawToken(),
                guest.id(), coupleId, couple != null ? couple.email() : null);
        return minted.guest();
    }

    // Bulk collector overload: mints the token (updating the guest) and appends this recipient to
    // the caller's outbox WITHOUT sending. The bulk caller fans the whole outbox out through
    // Resend's /emails/batch endpoint in one call via dispatchBatchInvites, so a 300-guest
    // invite-all costs a handful of API calls instead of 300 (issue #378).
    Guest issueInviteToBatch(Guest guest, UUID coupleId, WeddingWebsite website,
                             List<RsvpInviteRecipient> outbox) {
        MintedInvite minted = mintInvite(guest, coupleId, website);
        outbox.add(new RsvpInviteRecipient(guest.email(), guest.name(), guest.id(), minted.rawToken()));
        return minted.guest();
    }

    // Fires one batched Resend call for every recipient collected by issueInviteToBatch. The
    // couple-level fields (names, wedding date, reply-to) are identical for every recipient, so
    // they are computed once here rather than per guest. Guarded on a non-empty outbox so a send
    // with nothing to invite queues no background task at all.
    private void dispatchBatchInvites(List<RsvpInviteRecipient> outbox, UUID coupleId,
                                      WeddingWebsite website, Couple couple) {
        if (outbox.isEmpty()) {
            return;
        }
        asyncEmailService.sendRsvpInviteEmails(outbox, coupleId,
                inviteCoupleNames(couple), inviteWeddingDate(website),
                couple != null ? couple.email() : null);
    }

    // Shared minting core: validates the guest is invitable, revokes any outstanding invite
    // token, persists a fresh one, and stamps the guest's send count / sent-at. Returns the raw
    // token so the caller can either send one email (single path) or collect it into a batch.
    private MintedInvite mintInvite(Guest guest, UUID coupleId, WeddingWebsite website) {
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

        LocalDate coupleWeddingDate = website != null ? website.weddingDate() : null;
        String rawToken = UUID.randomUUID().toString();
        RsvpInviteToken token = new RsvpInviteToken(
                null, hash(rawToken), guest.id(),
                computeInviteExpiry(coupleWeddingDate, LocalDateTime.now()),
                false, null, RsvpInviteToken.SOURCE_INVITE
        );
        tokenRepository.save(token);

        // DEBUG, not INFO: this runs once per guest inside both bulk send loops, which each
        // already emit an aggregate INFO. Per-guest INFO here would break the no-INFO-in-loops
        // rule and inflate App Insights cost (observability rule 9).
        log.debug("rsvp invite queued, guestId={}, coupleId={}, sendNumber={}",
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
        return new MintedInvite(guestRepository.save(updated), rawToken);
    }

    // Internal holder pairing the persisted guest (returned to the single-send caller) with the
    // raw token the email needs. Not a DTO; never leaves this service.
    private record MintedInvite(Guest guest, String rawToken) {
    }

    private static String inviteCoupleNames(Couple couple) {
        return couple != null
                ? couple.partnerTwoName() + " & " + couple.partnerOneName()
                : "The Couple";
    }

    private static String inviteWeddingDate(WeddingWebsite website) {
        return (website != null && website.weddingDate() != null)
                ? website.weddingDate().format(DateTimeFormatter.ofPattern("MMMM d, yyyy"))
                : "TBD";
    }

    // Derive an RSVP invite token's expiry from the wedding date so the emailed link stays valid
    // through the wedding weekend, instead of a fixed 30 days after send (issue #216). Package
    // private and static (pure function of its inputs) so it is unit-testable without a Spring
    // context. Rules:
    //   - wedding date set: expires at end of (weddingDate + grace days);
    //   - no wedding date:  expires now + INVITE_EXPIRY_NO_DATE_DAYS;
    //   - floor: never before now + INVITE_EXPIRY_FLOOR_DAYS, covering a wedding that is tomorrow
    //     (or already past) so a late send still yields a usable link.
    static LocalDateTime computeInviteExpiry(LocalDate weddingDate, LocalDateTime now) {
        LocalDateTime floor = now.plusDays(INVITE_EXPIRY_FLOOR_DAYS);
        LocalDateTime candidate = weddingDate != null
                ? weddingDate.plusDays(INVITE_EXPIRY_GRACE_DAYS_AFTER_WEDDING).atTime(LocalTime.MAX)
                : now.plusDays(INVITE_EXPIRY_NO_DATE_DAYS);
        return candidate.isAfter(floor) ? candidate : floor;
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
