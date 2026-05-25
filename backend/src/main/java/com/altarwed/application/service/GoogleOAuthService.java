package com.altarwed.application.service;

import com.altarwed.application.dto.GoogleAuthUrlResponse;
import com.altarwed.application.dto.GoogleOAuthStatusResponse;
import com.altarwed.domain.model.Couple;
import com.altarwed.domain.model.GoogleOAuthToken;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.GoogleOAuthTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class GoogleOAuthService {

    private static final Logger log = LoggerFactory.getLogger(GoogleOAuthService.class);

    private static final String GOOGLE_AUTH_URL     = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String GOOGLE_TOKEN_URL    = "https://oauth2.googleapis.com/token";
    private static final String GOOGLE_REVOKE_URL   = "https://oauth2.googleapis.com/revoke";
    private static final String GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
    private static final String SHEETS_API_URL      = "https://sheets.googleapis.com/v4/spreadsheets";

    private static final List<String> SCOPES = List.of(
            "openid",
            "email",
            // Full spreadsheets scope (read + write) is required for UUID write-back.
            // Couples who authorized with the old spreadsheets.readonly scope will
            // continue to sync read-only until they disconnect and re-authorize.
            "https://www.googleapis.com/auth/spreadsheets"
    );

    private static final Pattern SHEET_ID_PATTERN =
            Pattern.compile("/spreadsheets/d/([a-zA-Z0-9_-]+)");

    private final GoogleOAuthTokenRepository tokenRepository;
    private final CoupleRepository coupleRepository;
    private final RestClient restClient;

    @Value("${altarwed.google.client-id}")
    private String clientId;

    @Value("${altarwed.google.client-secret}")
    private String clientSecret;

    @Value("${altarwed.google.redirect-uri}")
    private String redirectUri;

    @Value("${altarwed.app.base-url:https://app.altarwed.com}")
    private String appBaseUrl;

    // In-memory state store: state token -> coupleId, expires after 10 minutes.
    // Single-instance app (Azure App Service B2), so in-memory is fine.
    private final ConcurrentHashMap<String, PendingState> pendingStates = new ConcurrentHashMap<>();

    private record PendingState(UUID coupleId, long expiresEpochMs) {}

    public GoogleOAuthService(
            GoogleOAuthTokenRepository tokenRepository,
            CoupleRepository coupleRepository
    ) {
        this.tokenRepository = tokenRepository;
        this.coupleRepository = coupleRepository;
        // Spring Boot 4 does not auto-expose RestClient.Builder as a bean.
        // SimpleClientHttpRequestFactory wraps HttpURLConnection which follows
        // 302 redirects automatically. JdkClientHttpRequestFactory does not.
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(30_000);
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    // -------------------------------------------------------------------------
    // Couple lookup helper
    // -------------------------------------------------------------------------

    /**
     * Resolves the coupleId from the authenticated user's email.
     * The JWT principal is stored as the email string in the security context.
     */
    public UUID getCoupleIdByEmail(String email) {
        return coupleRepository.findByEmail(email)
                .map(Couple::id)
                .orElseThrow(() -> new IllegalStateException("No couple found for email"));
    }

    // -------------------------------------------------------------------------
    // Auth URL generation
    // -------------------------------------------------------------------------

    public GoogleAuthUrlResponse generateAuthUrl(UUID coupleId) {
        String state = UUID.randomUUID().toString();
        pendingStates.put(state, new PendingState(coupleId, System.currentTimeMillis() + 10 * 60 * 1000L));
        cleanExpiredStates();

        String scope = String.join(" ", SCOPES);
        String authUrl = UriComponentsBuilder.fromUriString(GOOGLE_AUTH_URL)
                .queryParam("client_id", clientId)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("response_type", "code")
                .queryParam("scope", URLEncoder.encode(scope, StandardCharsets.UTF_8))
                .queryParam("access_type", "offline")
                .queryParam("prompt", "consent")
                .queryParam("state", state)
                .build(true)
                .toUriString();

        log.info("google oauth auth url generated, coupleId={}", coupleId);
        return new GoogleAuthUrlResponse(authUrl);
    }

    // -------------------------------------------------------------------------
    // OAuth callback
    // -------------------------------------------------------------------------

    @Transactional
    public String handleCallback(String code, String state) {
        PendingState pending = pendingStates.remove(state);
        if (pending == null || System.currentTimeMillis() > pending.expiresEpochMs()) {
            log.warn("google oauth callback received invalid or expired state");
            return appBaseUrl + "/dashboard/guests?google_error=invalid_state";
        }

        UUID coupleId = pending.coupleId();
        log.info("google oauth callback received, coupleId={}", coupleId);

        try {
            Map<String, Object> tokenResponse = exchangeCode(code);

            String accessToken  = (String) tokenResponse.get("access_token");
            String refreshToken = (String) tokenResponse.get("refresh_token");
            String tokenType    = (String) tokenResponse.getOrDefault("token_type", "Bearer");
            Integer expiresIn   = (Integer) tokenResponse.get("expires_in");
            String scope        = (String) tokenResponse.get("scope");

            OffsetDateTime expiresAt = OffsetDateTime.now().plusSeconds(expiresIn != null ? expiresIn : 3599);

            // Fetch the Google account email to show in the UI
            String googleEmail = fetchUserEmail(accessToken);

            // Upsert token record
            GoogleOAuthToken existing = tokenRepository.findByCoupleId(coupleId).orElse(null);
            GoogleOAuthToken toSave = new GoogleOAuthToken(
                    existing != null ? existing.id() : null,
                    coupleId,
                    accessToken,
                    refreshToken != null ? refreshToken : (existing != null ? existing.refreshToken() : ""),
                    tokenType,
                    expiresAt,
                    googleEmail,
                    scope,
                    existing != null ? existing.createdAt() : null,
                    null
            );
            tokenRepository.save(toSave);

            log.info("google oauth tokens stored, coupleId={}", coupleId);
            return appBaseUrl + "/dashboard/guests?google_connected=true";

        } catch (Exception ex) {
            log.error("google oauth callback failed, coupleId={}", coupleId, ex);
            return appBaseUrl + "/dashboard/guests?google_error=token_exchange_failed";
        }
    }

    // -------------------------------------------------------------------------
    // Status and disconnect
    // -------------------------------------------------------------------------

    public GoogleOAuthStatusResponse getStatus(UUID coupleId) {
        return tokenRepository.findByCoupleId(coupleId)
                .map(t -> new GoogleOAuthStatusResponse(true, t.googleEmail()))
                .orElse(new GoogleOAuthStatusResponse(false, null));
    }

    @Transactional
    public void disconnect(UUID coupleId) {
        tokenRepository.findByCoupleId(coupleId).ifPresent(token -> {
            // Best-effort revoke at Google
            try {
                restClient.post()
                        .uri(GOOGLE_REVOKE_URL + "?token=" + token.accessToken())
                        .retrieve()
                        .toBodilessEntity();
                log.info("google oauth token revoked, coupleId={}", coupleId);
            } catch (Exception ex) {
                log.warn("google oauth revoke failed (non-fatal), coupleId={}", coupleId, ex);
            }
        });
        tokenRepository.deleteByCoupleId(coupleId);
        log.info("google oauth tokens deleted, coupleId={}", coupleId);
    }

    // -------------------------------------------------------------------------
    // Sheet reading (called by GoogleSheetSyncService)
    // -------------------------------------------------------------------------

    /**
     * Returns true if this couple has valid OAuth tokens stored.
     */
    public boolean hasOAuthTokens(UUID coupleId) {
        return tokenRepository.findByCoupleId(coupleId).isPresent();
    }

    /**
     * Reads all rows from the first sheet of the given spreadsheet URL.
     * Returns rows as List&lt;String[]&gt; (same format as CSV parser output),
     * including the header row as row[0].
     * Refreshes the access token automatically if it is expired.
     */
    @Transactional
    public List<String[]> readSheet(UUID coupleId, String sheetUrl) {
        String spreadsheetId = extractSpreadsheetId(sheetUrl);
        if (spreadsheetId == null) {
            throw new IllegalArgumentException(
                    "Could not extract spreadsheet ID from URL. " +
                    "Paste the URL from your browser address bar while the sheet is open.");
        }

        String accessToken = getValidAccessToken(coupleId);
        log.info("google sheets api read started, coupleId={}, spreadsheetId={}", coupleId, spreadsheetId);

        try {
            return doReadSheet(spreadsheetId, accessToken, coupleId);
        } catch (org.springframework.web.client.HttpClientErrorException.Unauthorized e) {
            // Token rejected; force refresh and retry once
            log.warn("google sheets api 401, refreshing token, coupleId={}", coupleId);
            String freshToken = refreshAccessToken(coupleId);
            return doReadSheet(spreadsheetId, freshToken, coupleId);
        }
    }

    /**
     * Writes cell values to a spreadsheet via the Sheets API batchUpdate.
     * Each key in cellValues is a cell range (e.g., "P2", "P3") and the value
     * is the string to write. Used by GoogleSheetSyncService for UUID write-back.
     *
     * Callers should catch HttpClientErrorException.Forbidden and treat it as a
     * non-fatal warning — it means the stored token has the old spreadsheets.readonly
     * scope and the couple needs to disconnect and re-authorize.
     */
    @Transactional
    public void writeSheetCells(UUID coupleId, String spreadsheetId, Map<String, String> cellValues) {
        if (cellValues.isEmpty()) return;

        String accessToken = getValidAccessToken(coupleId);
        String url = SHEETS_API_URL + "/" + spreadsheetId + "/values:batchUpdate";

        List<Map<String, Object>> data = cellValues.entrySet().stream()
                .map(e -> Map.<String, Object>of(
                        "range",  e.getKey(),
                        "values", List.of(List.of(e.getValue()))
                ))
                .toList();

        Map<String, Object> body = Map.of(
                "valueInputOption", "RAW",
                "data", data
        );

        log.info("google sheets write-back started, coupleId={}, spreadsheetId={}, cellCount={}",
                 coupleId, spreadsheetId, cellValues.size());

        restClient.post()
                .uri(url)
                .header("Authorization", "Bearer " + accessToken)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .toBodilessEntity();

        log.info("google sheets write-back succeeded, coupleId={}, spreadsheetId={}", coupleId, spreadsheetId);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    @SuppressWarnings("unchecked")
    private List<String[]> doReadSheet(String spreadsheetId, String accessToken, UUID coupleId) {
        String apiUrl = SHEETS_API_URL + "/" + spreadsheetId + "/values/A:Z?majorDimension=ROWS";

        Map<String, Object> response = restClient.get()
                .uri(apiUrl)
                .header("Authorization", "Bearer " + accessToken)
                .retrieve()
                .body(Map.class);

        if (response == null || !response.containsKey("values")) {
            log.info("google sheets api returned no values, coupleId={}", coupleId);
            return List.of();
        }

        List<List<Object>> rawRows = (List<List<Object>>) response.get("values");
        log.info("google sheets api read succeeded, coupleId={}, rows={}", coupleId, rawRows.size());

        return rawRows.stream()
                .map(row -> row.stream().map(Object::toString).toArray(String[]::new))
                .toList();
    }

    private String getValidAccessToken(UUID coupleId) {
        GoogleOAuthToken token = tokenRepository.findByCoupleId(coupleId)
                .orElseThrow(() -> new IllegalStateException(
                        "No Google account connected. Connect your Google account in the Sheets Sync panel."));

        // Refresh if token expires within the next 5 minutes
        if (token.expiresAt().isBefore(OffsetDateTime.now().plusMinutes(5))) {
            return refreshAccessToken(coupleId);
        }
        return token.accessToken();
    }

    @Transactional
    private String refreshAccessToken(UUID coupleId) {
        GoogleOAuthToken token = tokenRepository.findByCoupleId(coupleId)
                .orElseThrow(() -> new IllegalStateException("No OAuth token found for coupleId=" + coupleId));

        log.info("google oauth token refresh started, coupleId={}", coupleId);

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("refresh_token", token.refreshToken());
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        form.add("grant_type", "refresh_token");

        @SuppressWarnings("unchecked")
        Map<String, Object> resp = restClient.post()
                .uri(GOOGLE_TOKEN_URL)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(Map.class);

        String newAccessToken = (String) resp.get("access_token");
        Integer expiresIn     = (Integer) resp.get("expires_in");
        OffsetDateTime newExpiry = OffsetDateTime.now().plusSeconds(expiresIn != null ? expiresIn : 3599);

        GoogleOAuthToken updated = new GoogleOAuthToken(
                token.id(), token.coupleId(),
                newAccessToken, token.refreshToken(),
                token.tokenType(), newExpiry,
                token.googleEmail(), token.scope(),
                token.createdAt(), null
        );
        tokenRepository.save(updated);

        log.info("google oauth token refreshed, coupleId={}", coupleId);
        return newAccessToken;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> exchangeCode(String code) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("code", code);
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        form.add("redirect_uri", redirectUri);
        form.add("grant_type", "authorization_code");

        return restClient.post()
                .uri(GOOGLE_TOKEN_URL)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(Map.class);
    }

    @SuppressWarnings("unchecked")
    private String fetchUserEmail(String accessToken) {
        try {
            Map<String, Object> userInfo = restClient.get()
                    .uri(GOOGLE_USERINFO_URL)
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve()
                    .body(Map.class);
            return userInfo != null ? (String) userInfo.get("email") : null;
        } catch (Exception ex) {
            log.warn("google oauth failed to fetch user email (non-fatal)", ex);
            return null;
        }
    }

    private String extractSpreadsheetId(String url) {
        Matcher m = SHEET_ID_PATTERN.matcher(url);
        return m.find() ? m.group(1) : null;
    }

    private void cleanExpiredStates() {
        long now = System.currentTimeMillis();
        pendingStates.entrySet().removeIf(e -> e.getValue().expiresEpochMs() < now);
    }
}
