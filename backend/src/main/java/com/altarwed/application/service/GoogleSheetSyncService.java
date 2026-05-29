package com.altarwed.application.service;

import com.altarwed.application.dto.GoogleSheetSyncResponse;
import com.altarwed.application.dto.SetGoogleSheetSyncRequest;
import com.altarwed.domain.model.GoogleSheetSync;
import com.altarwed.domain.model.Guest;
import com.altarwed.domain.port.GoogleSheetSyncRepository;
import com.altarwed.domain.port.GuestRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.io.BufferedReader;
import java.io.StringReader;
import java.net.URI;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Manages Google Sheets live sync for guest lists.
 *
 * The couple must publish their sheet as CSV via:
 *   File > Share > Publish to web > Entire Document > CSV
 *
 * We also accept the standard edit/view URL and convert it automatically
 * to the CSV export URL:
 *   https://docs.google.com/spreadsheets/d/{id}/export?format=csv
 *
 * Expected CSV columns (case-insensitive, order flexible):
 *   Side, Names of all guests in Party (required), Phone Number, Email Address,
 *   Street Address, City, State, Zip Code, Allowed Plus One?, Plus One Name,
 *   RSVP Status, Table #, Dietary Restriction, Notes
 *
 * Old column names are supported as fallbacks for backward compatibility.
 *
 * Sync strategy: upsert by name (case-insensitive). If a guest with that name already
 * exists we update their fields (including email if newly added); otherwise we create
 * a new guest. Name is the stable identifier, email and other columns are enriched
 * on subsequent syncs. We never delete guests automatically (the couple may have
 * manually added notes).
 */
@Service
public class GoogleSheetSyncService {

    private static final Logger log = LoggerFactory.getLogger(GoogleSheetSyncService.class);

    // Matches the spreadsheet ID in any google sheets URL
    private static final Pattern SHEET_ID_PATTERN =
            Pattern.compile("/spreadsheets/d/([a-zA-Z0-9_-]+)");

    private final GoogleSheetSyncRepository syncRepository;
    private final GuestRepository guestRepository;
    private final GoogleOAuthService googleOAuthService;
    private final RestClient restClient;

    public GoogleSheetSyncService(
            GoogleSheetSyncRepository syncRepository,
            GuestRepository guestRepository,
            GoogleOAuthService googleOAuthService
    ) {
        this.syncRepository = syncRepository;
        this.guestRepository = guestRepository;
        this.googleOAuthService = googleOAuthService;
        // Spring Boot 4 does not auto-expose RestClient.Builder as a bean.
        // We explicitly use SimpleClientHttpRequestFactory (wraps HttpURLConnection)
        // rather than the default JdkClientHttpRequestFactory (wraps java.net.http.HttpClient).
        // Reason: Google Sheets publish-to-web CSV URLs issue a 302 redirect before
        // delivering the actual CSV. HttpClient does NOT follow redirects by default;
        // HttpURLConnection DOES. Without this, we silently get an empty body and
        // record 0 rows synced.
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(30_000);
        this.restClient = RestClient.builder()
                .requestFactory(factory)
                .build();
    }

    // -----------------------------------------------------------------------
    // CRUD for sync config
    // -----------------------------------------------------------------------

    @Transactional
    public GoogleSheetSyncResponse setSync(UUID coupleId, SetGoogleSheetSyncRequest request) {
        GoogleSheetSync existing = syncRepository.findByCoupleId(coupleId)
                .orElse(null);
        GoogleSheetSync toSave = new GoogleSheetSync(
                existing != null ? existing.id() : null,
                coupleId,
                request.sheetUrl().trim(),
                existing != null ? existing.lastSynced() : null,
                null,   // clear previous error on URL update
                existing != null ? existing.rowCount() : null,
                true,
                existing != null ? existing.createdAt() : null,
                null
        );
        return toResponse(syncRepository.save(toSave));
    }

    public Optional<GoogleSheetSyncResponse> getSync(UUID coupleId) {
        return syncRepository.findByCoupleId(coupleId).map(this::toResponse);
    }

    @Transactional
    public void deleteSync(UUID coupleId) {
        syncRepository.deleteByCoupleId(coupleId);
    }

    // -----------------------------------------------------------------------
    // Sync execution (called by scheduler and also available on-demand)
    // -----------------------------------------------------------------------

    @Transactional
    public GoogleSheetSyncResponse triggerSync(UUID coupleId) {
        GoogleSheetSync sync = syncRepository.findByCoupleId(coupleId)
                .orElseThrow(() -> new IllegalStateException("No Google Sheet sync configured for this couple."));
        return toResponse(runSync(sync).updatedSync());
    }

    // Same as triggerSync but exposes the per-run added/updated counts so the
    // dashboard can show a meaningful toast describing what happened.
    @Transactional
    public com.altarwed.application.dto.TriggerSyncResponse triggerSyncWithCounts(UUID coupleId) {
        GoogleSheetSync sync = syncRepository.findByCoupleId(coupleId)
                .orElseThrow(() -> new IllegalStateException("No Google Sheet sync configured for this couple."));
        SyncResult result = runSync(sync);
        return new com.altarwed.application.dto.TriggerSyncResponse(
                toResponse(result.updatedSync()), result.added(), result.updated()
        );
    }

    // Transient per-run sync outcome, not persisted, used to surface counts to the UI.
    // `added` and `updated` are null on failure (the persisted sync still gets the error message).
    private record SyncResult(GoogleSheetSync updatedSync, Integer added, Integer updated) {}

    /**
     * Called by the scheduler; processes all active configs.
     * Returns a two-element int array: [succeeded, failed].
     * The scheduler uses these counts to include them in its finish log,
     * keeping all outcome data on the runId-tagged line for KQL correlation.
     */
    public int[] runAllActive() {
        List<GoogleSheetSync> active = syncRepository.findAllActive();
        log.info("google sheet sync batch started, activeConfigs={}", active.size());
        int succeeded = 0;
        int failed = 0;
        for (GoogleSheetSync sync : active) {
            try {
                runSync(sync);
                succeeded++;
            } catch (Exception ex) {
                failed++;
                log.warn("google sheet sync failed for couple, coupleId={}", sync.coupleId(), ex);
            }
        }
        log.info("google sheet sync batch finished, succeeded={}, failed={}", succeeded, failed);
        return new int[]{succeeded, failed};
    }

    // -----------------------------------------------------------------------
    // Core sync logic
    // -----------------------------------------------------------------------

    private SyncResult runSync(GoogleSheetSync sync) {
        log.info("google sheet sync started, coupleId={}", sync.coupleId());
        try {
            UpsertCounts counts;
            if (googleOAuthService.hasOAuthTokens(sync.coupleId())) {
                // OAuth path: read via Sheets API + UUID write-back for stable row identity
                log.info("google sheet sync using oauth with uuid write-back, coupleId={}", sync.coupleId());
                String spreadsheetId = extractSpreadsheetId(sync.sheetUrl());
                if (spreadsheetId == null) {
                    throw new IllegalArgumentException(
                            "Could not extract spreadsheet ID from URL. " +
                            "Paste the URL from your browser address bar while the sheet is open.");
                }
                counts = upsertGuestsWithWriteBack(sync.coupleId(), spreadsheetId, sync.sheetUrl());
            } else {
                // No-OAuth fallback: read public CSV, upsert by name
                log.info("google sheet sync using public csv url, coupleId={}", sync.coupleId());
                String csvUrl = toCsvUrl(sync.sheetUrl());
                String csv = fetchCsv(csvUrl);
                List<String[]> rows = parseCsv(csv);
                counts = upsertGuestsByName(sync.coupleId(), rows);
            }

            GoogleSheetSync updated = new GoogleSheetSync(
                    sync.id(), sync.coupleId(), sync.sheetUrl(),
                    LocalDateTime.now(), null, counts.seen(),
                    true, sync.createdAt(), null
            );
            GoogleSheetSync saved = syncRepository.save(updated);
            log.info("google sheet sync succeeded, coupleId={}, added={}, updated={}, seen={}",
                     sync.coupleId(), counts.added(), counts.updated(), counts.seen());
            return new SyncResult(saved, counts.added(), counts.updated());
        } catch (Exception e) {
            String errorMsg = e.getMessage() != null
                    ? e.getMessage().substring(0, Math.min(e.getMessage().length(), 990))
                    : "Unknown error";
            log.warn("google sheet sync errored, coupleId={}", sync.coupleId(), e);
            GoogleSheetSync errored = new GoogleSheetSync(
                    sync.id(), sync.coupleId(), sync.sheetUrl(),
                    sync.lastSynced(), errorMsg, sync.rowCount(),
                    true, sync.createdAt(), null
            );
            return new SyncResult(syncRepository.save(errored), null, null);
        }
    }

    // Per-run upsert breakdown.
    // `added`   = brand-new guests created
    // `updated` = existing guests whose merged state actually differs from the DB row
    //             (NOT a count of every existing row seen, that would always report
    //             "updated" on a no-op sync and erode trust in the toast)
    // `seen`    = every non-blank row in the sheet, persisted as the GoogleSheetSync.rowCount
    private record UpsertCounts(int added, int updated, int seen) {}

    /**
     * Converts any Google Sheets URL to a CSV export URL.
     * Handles edit URLs, view URLs, and already-correct export URLs.
     */
    static String toCsvUrl(String url) {
        if (url.contains("export?format=csv") || url.contains("output=csv")) {
            return url;
        }
        Matcher m = SHEET_ID_PATTERN.matcher(url);
        if (m.find()) {
            return "https://docs.google.com/spreadsheets/d/" + m.group(1) + "/export?format=csv";
        }
        // Fallback: assume the user gave us the direct CSV URL
        return url;
    }

    private String fetchCsv(String url) {
        log.info("google sheet csv fetch started, url={}", url);
        String csv = restClient.get()
                .uri(URI.create(url))
                .header("Accept", "text/csv, text/plain, */*")
                .header("User-Agent", "AltarWed-Guest-Sync/1.0")
                .retrieve()
                .body(String.class);

        if (csv == null || csv.isBlank()) {
            throw new IllegalStateException(
                "Google Sheets returned an empty response. " +
                "Ensure the sheet is published to the web: " +
                "File > Share > Publish to web > Comma-separated values (.csv).");
        }

        // If we got HTML, the sheet is not publicly published or the URL is wrong.
        if (csv.stripLeading().startsWith("<")) {
            throw new IllegalStateException(
                "Google Sheets returned HTML instead of CSV. " +
                "The sheet must be published publicly: " +
                "File > Share > Publish to web > select Comma-separated values (.csv).");
        }

        // Strip UTF-8 BOM (U+FEFF, bytes 0xEF 0xBB 0xBF) that Google prepends for
        // Excel compatibility. String.trim() does NOT strip BOM. The string literal
        // below contains the literal BOM character; the Java UTF-8 compiler preserves it.
        if (csv.charAt(0) == '﻿') {
            csv = csv.substring(1);
        }

        log.info("google sheet csv fetched, bytes={}", csv.length());
        return csv;
    }

    /**
     * OAuth sync path: reads via Sheets API, stamps a UUID into the "AltarWed ID"
     * column for each new row, and uses that UUID as the stable row key on all
     * future syncs. This survives name changes, email additions, reordering, any
     * mutation other than deleting the UUID cell itself.
     *
     * Write-back is best-effort: if the stored token has the old spreadsheets.readonly
     * scope the write call returns 403. We catch that, log a warning, and continue
     * syncing read-only. The couple just needs to disconnect + re-authorize once.
     */
    private UpsertCounts upsertGuestsWithWriteBack(UUID coupleId, String spreadsheetId, String sheetUrl) throws Exception {
        List<String[]> rows = googleOAuthService.readSheet(coupleId, sheetUrl);
        if (rows.isEmpty()) return new UpsertCounts(0, 0, 0);

        String[] headers = rows.get(0);
        Map<String, Integer> colIndex = buildColumnIndex(headers);
        validateRequiredColumns(colIndex, headers);

        // Locate or plan the "AltarWed ID" column.
        // Header is "AltarWed ID (do not modify)" so couples see the warning
        // right in the sheet. Accept any variant containing "altarwed id" for
        // backward compat with sheets stamped before the warning was added.
        boolean needToWriteHeader = false;
        int idColIndex = -1;
        for (Map.Entry<String, Integer> e : colIndex.entrySet()) {
            if (e.getKey().startsWith("altarwed id")) {
                idColIndex = e.getValue();
                break;
            }
        }
        if (idColIndex == -1) {
            idColIndex = headers.length; // append as the next column
            needToWriteHeader = true;
        }
        String idColLetter = columnLetter(idColIndex);

        // Build lookup maps from existing guests
        List<Guest> existing = guestRepository.findAllByCoupleId(coupleId);
        Map<String, Guest> bySheetSyncId = existing.stream()
                .filter(g -> g.sheetSyncId() != null)
                .collect(Collectors.toMap(Guest::sheetSyncId, Function.identity(), (a, b) -> a));
        // Name-keyed fallback for guests synced before write-back was introduced (sheetSyncId == null)
        Map<String, Guest> byNameFallback = existing.stream()
                .filter(g -> g.sheetSyncId() == null)
                .collect(Collectors.toMap(
                        g -> g.name().toLowerCase().trim(),
                        Function.identity(),
                        (a, b) -> a));

        // cellRange → value to write back (e.g., "P1" → "AltarWed ID", "P2" → "uuid-...")
        Map<String, String> writeBackCells = new LinkedHashMap<>();
        if (needToWriteHeader) {
            writeBackCells.put(idColLetter + "1", "AltarWed ID (do not modify)");
        }

        List<Guest> toSave = new ArrayList<>();
        int added = 0;
        int updated = 0;
        int seen = 0;

        for (int i = 1; i < rows.size(); i++) {
            int sheetRowNumber = i + 1; // sheet row 1 = header, data starts at row 2
            String[] cols = rows.get(i);

            String name = getAny(cols, colIndex,
                    "names of all guests in party",
                    "names of all guests in party (separated by , if multiple)",
                    "name");
            if (name == null || name.isBlank()) continue;
            seen++;

            // Read the UUID that was stamped on a previous sync (if any)
            String existingUuid = null;
            if (idColIndex < cols.length) {
                String v = cols[idColIndex].trim();
                if (!v.isEmpty()) existingUuid = v;
            }

            // Resolve existing DB guest: UUID first, name as migration-period fallback
            Guest g = existingUuid != null ? bySheetSyncId.get(existingUuid) : null;
            if (g == null) {
                g = byNameFallback.get(name.toLowerCase().trim());
            }

            // Parse all columns (same logic as the CSV path)
            String side        = getAny(cols, colIndex, "side");
            String phone       = getAny(cols, colIndex, "phone number", "phone");
            String emailVal    = getAny(cols, colIndex, "email address", "email");
            String street      = getAny(cols, colIndex, "street address", "address line 1");
            String apt         = getAny(cols, colIndex, "apt/suite", "apt", "suite");
            String city        = getAny(cols, colIndex, "city");
            String state       = getAny(cols, colIndex, "state");
            String zip         = getAny(cols, colIndex, "zip code", "zip");
            String plusOneRaw  = getAny(cols, colIndex, "allowed plus one?", "allowed plus one", "plus one allowed");
            String plusOneName = getAny(cols, colIndex, "plus one name");
            String rsvpRaw     = getAny(cols, colIndex, "rsvp status");
            String tableRaw    = getAny(cols, colIndex, "table #", "table number", "table");
            String dietary     = getAny(cols, colIndex, "dietary restriction", "dietary restrictions");
            String notes       = getAny(cols, colIndex, "notes");

            String mailLine1 = street != null ? (apt != null ? street + " " + apt : street) : null;
            boolean plusOneAllowed = plusOneRaw != null &&
                    (plusOneRaw.equalsIgnoreCase("yes") || plusOneRaw.equalsIgnoreCase("true") || plusOneRaw.equals("1"));
            com.altarwed.domain.model.GuestRsvpStatus rsvpStatus = parseRsvpStatus(rsvpRaw);
            Integer tableNumber = parseTableNumber(tableRaw);
            com.altarwed.domain.model.GuestSide sideVal = parseSide(side);

            // Assign or reuse the UUID for this row
            String syncId;
            if (existingUuid != null) {
                syncId = existingUuid;
            } else {
                syncId = UUID.randomUUID().toString();
                writeBackCells.put(idColLetter + sheetRowNumber, syncId);
            }

            if (g == null) {
                toSave.add(new Guest(
                        null, coupleId, name, emailVal,
                        phone,
                        rsvpStatus != null ? rsvpStatus : com.altarwed.domain.model.GuestRsvpStatus.PENDING,
                        plusOneAllowed,
                        plusOneName, dietary,
                        null,       // songRequest
                        tableNumber,
                        sideVal,
                        notes,
                        mailLine1, city, state, zip,
                        null, 0,    // noteForCouple, inviteSendCount
                        null, null, null, null, null,  // inviteSentAt, respondedAt, remindAt, createdAt, updatedAt
                        null, null, null,  // partyId, partyName, partyContact
                        syncId
                ));
                added++;
            } else {
                // Non-destructive merge: sheet value wins if non-null, else keep manual edits.
                // We then equals-check against the existing DB row so unchanged rows are NOT
                // counted as "updated" in the toast (and not re-saved either, small DB win).
                Guest merged = new Guest(
                        g.id(), g.coupleId(), name,
                        emailVal    != null ? emailVal    : g.email(),
                        phone       != null ? phone       : g.phone(),
                        rsvpStatus  != null ? rsvpStatus  : g.rsvpStatus(),
                        plusOneRaw  != null ? plusOneAllowed : g.plusOneAllowed(),
                        plusOneName != null ? plusOneName : g.plusOneName(),
                        dietary     != null ? dietary     : g.dietaryRestrictions(),
                        g.songRequest(),
                        tableNumber != null ? tableNumber : g.tableNumber(),
                        sideVal     != null ? sideVal     : g.side(),
                        notes       != null ? notes       : g.notes(),
                        mailLine1   != null ? mailLine1   : g.mailLine1(),
                        city        != null ? city        : g.mailCity(),
                        state       != null ? state       : g.mailState(),
                        zip         != null ? zip         : g.mailZip(),
                        g.noteForCouple(),
                        g.inviteSendCount(), g.inviteSentAt(), g.respondedAt(), g.remindAt(),
                        g.createdAt(), g.updatedAt(),
                        g.partyId(), g.partyName(), g.partyContact(),
                        syncId  // stamp UUID even when resolved via name fallback
                );
                // Consume from name map so a second row with the same name creates a new guest.
                byNameFallback.remove(name.toLowerCase().trim());
                if (!merged.equals(g)) {
                    toSave.add(merged);
                    updated++;
                }
                // else: nothing changed in the sheet for this guest, skip the write entirely
            }
        }

        guestRepository.saveAll(toSave);

        // Write UUIDs back to the sheet, best-effort, non-fatal.
        // Runs even when no guests changed, because newly-generated UUIDs for previously
        // unstamped rows still need to be written into the spreadsheet for future syncs.
        if (!writeBackCells.isEmpty()) {
            try {
                googleOAuthService.writeSheetCells(coupleId, spreadsheetId, writeBackCells);
            } catch (org.springframework.web.client.HttpClientErrorException.Forbidden ex) {
                log.warn("google sheet uuid write-back skipped, insufficient scope (re-authorize required), coupleId={}", coupleId);
            } catch (Exception ex) {
                log.warn("google sheet uuid write-back failed (non-fatal), coupleId={}", coupleId, ex);
            }
        }

        return new UpsertCounts(added, updated, seen);
    }

    /**
     * CSV fallback path for couples without OAuth.
     * Upserts by lowercased name, stable enough for public sheets where write-back
     * is not possible. Name changes will create a new guest; the old one is not deleted.
     */
    private UpsertCounts upsertGuestsByName(UUID coupleId, List<String[]> rows) throws Exception {
        if (rows.isEmpty()) return new UpsertCounts(0, 0, 0);

        String[] headers = rows.get(0);
        Map<String, Integer> colIndex = buildColumnIndex(headers);
        validateRequiredColumns(colIndex, headers);

        List<Guest> existing = guestRepository.findAllByCoupleId(coupleId);
        Map<String, Guest> byName = existing.stream()
                .collect(Collectors.toMap(
                        g -> g.name().toLowerCase().trim(),
                        Function.identity(),
                        (a, b) -> a));

        List<Guest> toSave = new ArrayList<>();
        int added = 0;
        int updated = 0;
        int seen = 0;

        for (int i = 1; i < rows.size(); i++) {
            String[] cols = rows.get(i);
            String name = getAny(cols, colIndex,
                    "names of all guests in party",
                    "names of all guests in party (separated by , if multiple)",
                    "name");
            if (name == null || name.isBlank()) continue;
            seen++;

            Guest g = byName.get(name.toLowerCase().trim());

            String side        = getAny(cols, colIndex, "side");
            String phone       = getAny(cols, colIndex, "phone number", "phone");
            String emailVal    = getAny(cols, colIndex, "email address", "email");
            String street      = getAny(cols, colIndex, "street address", "address line 1");
            String apt         = getAny(cols, colIndex, "apt/suite", "apt", "suite");
            String city        = getAny(cols, colIndex, "city");
            String state       = getAny(cols, colIndex, "state");
            String zip         = getAny(cols, colIndex, "zip code", "zip");
            String plusOneRaw  = getAny(cols, colIndex, "allowed plus one?", "allowed plus one", "plus one allowed");
            String plusOneName = getAny(cols, colIndex, "plus one name");
            String rsvpRaw     = getAny(cols, colIndex, "rsvp status");
            String tableRaw    = getAny(cols, colIndex, "table #", "table number", "table");
            String dietary     = getAny(cols, colIndex, "dietary restriction", "dietary restrictions");
            String notes       = getAny(cols, colIndex, "notes");

            String mailLine1 = street != null ? (apt != null ? street + " " + apt : street) : null;
            boolean plusOneAllowed = plusOneRaw != null &&
                    (plusOneRaw.equalsIgnoreCase("yes") || plusOneRaw.equalsIgnoreCase("true") || plusOneRaw.equals("1"));
            com.altarwed.domain.model.GuestRsvpStatus rsvpStatus = parseRsvpStatus(rsvpRaw);
            Integer tableNumber = parseTableNumber(tableRaw);
            com.altarwed.domain.model.GuestSide sideVal = parseSide(side);

            if (g == null) {
                toSave.add(new Guest(
                        null, coupleId, name, emailVal,
                        phone,
                        rsvpStatus != null ? rsvpStatus : com.altarwed.domain.model.GuestRsvpStatus.PENDING,
                        plusOneAllowed,
                        plusOneName, dietary,
                        null, tableNumber, sideVal, notes,
                        mailLine1, city, state, zip,
                        null, 0,
                        null, null, null, null, null,
                        null, null, null,
                        null  // sheetSyncId, CSV path cannot write-back
                ));
                added++;
            } else {
                // Build the would-be merged Guest, then equals-check against existing.
                // Only save + count as "updated" if something actually changed.
                Guest merged = new Guest(
                        g.id(), g.coupleId(), name,
                        emailVal    != null ? emailVal    : g.email(),
                        phone       != null ? phone       : g.phone(),
                        rsvpStatus  != null ? rsvpStatus  : g.rsvpStatus(),
                        plusOneRaw  != null ? plusOneAllowed : g.plusOneAllowed(),
                        plusOneName != null ? plusOneName : g.plusOneName(),
                        dietary     != null ? dietary     : g.dietaryRestrictions(),
                        g.songRequest(),
                        tableNumber != null ? tableNumber : g.tableNumber(),
                        sideVal     != null ? sideVal     : g.side(),
                        notes       != null ? notes       : g.notes(),
                        mailLine1   != null ? mailLine1   : g.mailLine1(),
                        city        != null ? city        : g.mailCity(),
                        state       != null ? state       : g.mailState(),
                        zip         != null ? zip         : g.mailZip(),
                        g.noteForCouple(),
                        g.inviteSendCount(), g.inviteSentAt(), g.respondedAt(), g.remindAt(),
                        g.createdAt(), g.updatedAt(),
                        g.partyId(), g.partyName(), g.partyContact(),
                        g.sheetSyncId()  // preserve any UUID already stamped
                );
                if (!merged.equals(g)) {
                    toSave.add(merged);
                    updated++;
                }
                // else: unchanged, skip the write
            }
        }

        guestRepository.saveAll(toSave);
        return new UpsertCounts(added, updated, seen);
    }

    // -----------------------------------------------------------------------
    // Shared parsing helpers (used by both sync paths)
    // -----------------------------------------------------------------------

    private void validateRequiredColumns(Map<String, Integer> colIndex, String[] headers) {
        boolean hasNameCol = colIndex.containsKey("names of all guests in party")
                || colIndex.containsKey("names of all guests in party (separated by , if multiple)")
                || colIndex.containsKey("name");
        if (!hasNameCol) {
            throw new IllegalArgumentException(
                "Sheet does not contain a 'Name' or 'Names of all guests in Party' column " +
                "(also accepted: 'Names of all guests in Party (separated by , if multiple)'). " +
                "Ensure the first row contains column headers. " +
                "Expected: Side, Names of all guests in Party, Phone Number, Email Address, " +
                "Street Address, City, State, Zip Code, Allowed Plus One?, Plus One Name, RSVP Status, " +
                "Table #, Dietary Restriction, Notes. " +
                "Actual headers: " + String.join(", ", headers));
        }
    }

    private com.altarwed.domain.model.GuestRsvpStatus parseRsvpStatus(String raw) {
        if (raw == null) return null;
        String r = raw.trim().toUpperCase();
        if (r.equals("ATTENDING") || r.equals("YES") || r.equals("GOING"))
            return com.altarwed.domain.model.GuestRsvpStatus.ATTENDING;
        if (r.equals("DECLINING") || r.equals("NO") || r.equals("NOT GOING") || r.equals("DECLINED"))
            return com.altarwed.domain.model.GuestRsvpStatus.DECLINING;
        return null; // unknown value → keep existing / PENDING
    }

    private Integer parseTableNumber(String raw) {
        if (raw == null) return null;
        try { return Integer.parseInt(raw.trim()); } catch (NumberFormatException ignored) { return null; }
    }

    private com.altarwed.domain.model.GuestSide parseSide(String raw) {
        if (raw == null) return null;
        String s = raw.trim().toUpperCase();
        if (s.equals("BRIDE") || s.equals("BRIDE SIDE")) return com.altarwed.domain.model.GuestSide.BRIDE;
        if (s.equals("GROOM") || s.equals("GROOM SIDE")) return com.altarwed.domain.model.GuestSide.GROOM;
        if (s.equals("BOTH")) return com.altarwed.domain.model.GuestSide.BOTH;
        return null;
    }

    /**
     * Converts a 0-based column index to a spreadsheet column letter (A, B, ..., Z, AA, AB, ...).
     * Index 0 → "A", 25 → "Z", 26 → "AA".
     */
    static String columnLetter(int zeroBasedIndex) {
        StringBuilder sb = new StringBuilder();
        int n = zeroBasedIndex + 1; // convert to 1-based
        while (n > 0) {
            n--;  // shift to 0-based within the 26-letter cycle
            sb.insert(0, (char) ('A' + (n % 26)));
            n /= 26;
        }
        return sb.toString();
    }

    /** Extracts the spreadsheet ID from any Google Sheets URL. Returns null if not found. */
    private String extractSpreadsheetId(String url) {
        Matcher m = SHEET_ID_PATTERN.matcher(url);
        return m.find() ? m.group(1) : null;
    }

    // -----------------------------------------------------------------------
    // CSV parsing helpers
    // -----------------------------------------------------------------------

    /** Minimal RFC-4180 CSV parser, handles quoted fields with commas. */
    private List<String[]> parseCsv(String csv) throws Exception {
        List<String[]> result = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new StringReader(csv))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.isBlank()) result.add(splitCsvLine(line));
            }
        }
        return result;
    }

    private String[] splitCsvLine(String line) {
        List<String> fields = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    sb.append('"');
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c == ',' && !inQuotes) {
                fields.add(sb.toString().trim());
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        fields.add(sb.toString().trim());
        return fields.toArray(new String[0]);
    }

    private Map<String, Integer> buildColumnIndex(String[] headers) {
        Map<String, Integer> map = new HashMap<>();
        for (int i = 0; i < headers.length; i++) {
            map.put(headers[i].toLowerCase().trim(), i);
        }
        return map;
    }

    private String get(String[] cols, Map<String, Integer> index, String colName) {
        Integer i = index.get(colName);
        if (i == null || i >= cols.length) return null;
        String v = cols[i].trim();
        return v.isEmpty() ? null : v;
    }

    /** Like get() but tries multiple column names in order, returns first non-null. */
    private String getAny(String[] cols, Map<String, Integer> index, String... names) {
        for (String name : names) {
            String v = get(cols, index, name);
            if (v != null) return v;
        }
        return null;
    }

    // -----------------------------------------------------------------------
    // Mapper
    // -----------------------------------------------------------------------

    private GoogleSheetSyncResponse toResponse(GoogleSheetSync s) {
        return new GoogleSheetSyncResponse(
                s.id(), s.coupleId(), s.sheetUrl(),
                s.lastSynced(), s.lastError(), s.rowCount(),
                s.isActive(), s.createdAt(), s.updatedAt()
        );
    }
}
