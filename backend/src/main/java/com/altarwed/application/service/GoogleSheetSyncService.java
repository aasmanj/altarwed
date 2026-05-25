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
 *   Name (required), Email, Plus One Name, Meal Preference, Dietary Restrictions,
 *   Song Request, Shuttle Needed (yes/no/true/false)
 *
 * Sync strategy: upsert by name (case-insensitive). If a guest with that name already
 * exists we update their fields (including email if newly added); otherwise we create
 * a new guest. Name is the stable identifier — email and other columns are enriched
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
        return toResponse(runSync(sync));
    }

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

    private GoogleSheetSync runSync(GoogleSheetSync sync) {
        log.info("google sheet sync started, coupleId={}", sync.coupleId());
        try {
            List<String[]> rows;
            if (googleOAuthService.hasOAuthTokens(sync.coupleId())) {
                log.info("google sheet sync using oauth, coupleId={}", sync.coupleId());
                rows = googleOAuthService.readSheet(sync.coupleId(), sync.sheetUrl());
            } else {
                log.info("google sheet sync using public url, coupleId={}", sync.coupleId());
                String csvUrl = toCsvUrl(sync.sheetUrl());
                String csv = fetchCsv(csvUrl);
                rows = parseCsv(csv);
            }
            int rowsProcessed = upsertGuestsFromRows(sync.coupleId(), rows);

            GoogleSheetSync updated = new GoogleSheetSync(
                    sync.id(), sync.coupleId(), sync.sheetUrl(),
                    LocalDateTime.now(), null, rowsProcessed,
                    true, sync.createdAt(), null
            );
            GoogleSheetSync saved = syncRepository.save(updated);
            log.info("google sheet sync succeeded, coupleId={}, rowsProcessed={}",
                     sync.coupleId(), rowsProcessed);
            return saved;
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
            return syncRepository.save(errored);
        }
    }

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
     * Upserts guests by (name, email) from pre-parsed rows.
     * Row[0] is the header row. Returns the number of data rows successfully processed.
     */
    private int upsertGuestsFromRows(UUID coupleId, List<String[]> rows) throws Exception {
        if (rows.isEmpty()) return 0;

        String[] headers = rows.get(0);
        Map<String, Integer> colIndex = buildColumnIndex(headers);

        if (!colIndex.containsKey("name")) {
            throw new IllegalArgumentException(
                "CSV does not contain a 'Name' column. " +
                "Ensure the sheet is published as CSV and the first row contains column headers: " +
                "Name, Email, Plus One Name, Meal Preference, Dietary Restrictions, Song Request. " +
                "Actual headers found: " + String.join(", ", headers));
        }

        // Load existing guests for efficient lookup.
        // Key by lowercased name only — email is often absent on the first sync
        // and added on a later one. Keying by name|email would treat the same
        // person as a new guest each time a field is filled in, creating duplicates.
        // If two guests share a name the first one wins (collision handler keeps a).
        List<Guest> existing = guestRepository.findAllByCoupleId(coupleId);
        Map<String, Guest> byName = existing.stream()
                .collect(Collectors.toMap(
                        g -> g.name().toLowerCase().trim(),
                        Function.identity(),
                        (a, b) -> a   // keep first on same-name collision
                ));

        List<Guest> toSave = new ArrayList<>();
        int processed = 0;
        for (int i = 1; i < rows.size(); i++) {
            String[] cols = rows.get(i);
            String name = get(cols, colIndex, "name");
            if (name == null || name.isBlank()) continue;

            String email = get(cols, colIndex, "email");
            Guest g = byName.get(name.toLowerCase().trim());

            String plusOneName       = get(cols, colIndex, "plus one name");
            String mealPref          = get(cols, colIndex, "meal preference");
            String dietary           = get(cols, colIndex, "dietary restrictions");
            String songRequest       = get(cols, colIndex, "song request");
            if (g == null) {
                // New guest — id=null so JPA generates one; phone=null; tableNumber=null; side=null
                toSave.add(new Guest(
                        null, coupleId, name, email,
                        null,   // phone
                        com.altarwed.domain.model.GuestRsvpStatus.PENDING,
                        false,  // plusOneAllowed (primitive, defaults false)
                        plusOneName, dietary, mealPref, songRequest,
                        null,   // tableNumber
                        null,   // side
                        null,   // notes
                        null, null, null, null,   // mailLine1/City/State/Zip (not in sheet)
                        null,   // noteForCouple
                        0,      // inviteSendCount
                        null,   // inviteSentAt
                        null,   // respondedAt
                        null,   // remindAt
                        null,   // createdAt (set by @PrePersist)
                        null,   // updatedAt
                        null, null, null  // partyId, partyName, partyContact
                ));
            } else {
                // Update only non-RSVP fields; preserve everything the couple set manually
                toSave.add(new Guest(
                        g.id(), g.coupleId(), name,
                        email       != null ? email       : g.email(),
                        g.phone(),
                        g.rsvpStatus(),
                        g.plusOneAllowed(),
                        plusOneName != null ? plusOneName : g.plusOneName(),
                        dietary     != null ? dietary     : g.dietaryRestrictions(),
                        mealPref    != null ? mealPref    : g.mealPreference(),
                        songRequest != null ? songRequest : g.songRequest(),
                        g.tableNumber(), g.side(), g.notes(),
                        g.mailLine1(), g.mailCity(), g.mailState(), g.mailZip(),
                        g.noteForCouple(),
                        g.inviteSendCount(), g.inviteSentAt(), g.respondedAt(), g.remindAt(),
                        g.createdAt(), g.updatedAt(),
                        g.partyId(), g.partyName(), g.partyContact()
                ));
            }
            processed++;
        }

        guestRepository.saveAll(toSave);
        return processed;
    }

    // -----------------------------------------------------------------------
    // CSV parsing helpers
    // -----------------------------------------------------------------------

    /** Minimal RFC-4180 CSV parser — handles quoted fields with commas. */
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
