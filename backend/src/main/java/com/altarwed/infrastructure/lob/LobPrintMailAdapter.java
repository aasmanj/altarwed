package com.altarwed.infrastructure.lob;

import com.altarwed.domain.port.PrintMailPort;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

/**
 * Lob.com adapter for printing + mailing wedding postcards.
 *
 * Lob authenticates with Basic auth using the API key as the username and an empty password.
 * Test-mode keys start with "test_", live keys start with "live_". Test mode returns a real
 * postcard ID and renders a preview PDF but does NOT print or mail anything.
 *
 * Templates: we use inline HTML with Handlebars-style merge variables so couples can be
 * served by one of a small number of AltarWed-branded card designs without us managing
 * Lob template objects yet. Switch to template_id once we curate the design set.
 */
@Component
public class LobPrintMailAdapter implements PrintMailPort {

    private static final Logger log = LoggerFactory.getLogger(LobPrintMailAdapter.class);

    // Lob 6x11 postcard. Lob validates the rendered HTML against the BLEED dimensions for the
    // chosen size and returns 422 UNPROCESSABLE_CONTENT on a mismatch. For 6x11 the trim (final
    // card) is 11in x 6in and the bleed adds 0.125in on every edge, so the front and back HTML
    // MUST render at 11.25in x 6.25in (see the @page rules in renderFront/renderBack). This bit
    // us once: the template rendered at the 11in x 6in trim size and every postcard 422'd.
    // Ref: https://help.lob.com/print-and-mail/designing-mail-creatives/mail-piece-design-specs/postcards
    private static final String POSTCARD_SIZE = "6x11";

    // Lob requires a use_type on every mail piece (and 422s without it unless an account default
    // is set in the dashboard). The only mail this adapter sends is a couple's own save-the-dates
    // and invitations to their own guest list, which is personal correspondence about an event,
    // NOT advertising of a commercial product, so the correct category is "operational", not
    // "marketing". Setting it in code (rather than relying on a dashboard default) keeps the
    // classification explicit, versioned, and stable across new accounts/API keys.
    // Ref: https://help.lob.com/print-and-mail/building-a-mail-strategy/htmls-and-use-types
    private static final String MAIL_USE_TYPE = "operational";

    // Cap for the extracted Lob error so it always fits print_order_recipients.error_message
    // (NVARCHAR(500)); kept under 500 to leave headroom and avoid a SQL 2628 truncation abort.
    private static final int MAX_ERROR_DETAIL = 480;

    private final String apiKey;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public LobPrintMailAdapter(
            @Value("${altarwed.lob.api-key:}") String apiKey,
            ObjectMapper objectMapper
    ) {
        this.apiKey = apiKey;
        this.objectMapper = objectMapper;
        String basic = Base64.getEncoder().encodeToString((apiKey + ":").getBytes(StandardCharsets.UTF_8));
        // Pin an explicit request factory with timeouts, matching the other timeout-pinned RestClient
        // adapters (ResendEmailAdapter, GoogleSheetSyncService, GoogleOAuthService). Without a
        // requestFactory RestClient auto-detects Reactor Netty from the classpath, whose ~10s default
        // read timeout is too short for Lob: creating a postcard makes Lob fetch the hero image and
        // rasterize the card HTML to a PDF, which routinely runs longer than a plain JSON call, and
        // the short default surfaced as a per-recipient transport failure (ReadTimeoutException). 30s read
        // (the value the other slow-rendering integrations use) absorbs render spikes; SimpleClient
        // is blocking, which is ideal here because the app runs on virtual threads so the carrier
        // thread is released during the wait.
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(30));
        this.restClient = RestClient.builder()
                .requestFactory(factory)
                .baseUrl("https://api.lob.com/v1")
                .defaultHeader("Authorization", "Basic " + basic)
                .build();
    }

    @Override
    public String sendPostcard(PostcardRequest req) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new PrintMailException("Lob API key not configured. Set LOB_API_KEY env var.");
        }
        // DEBUG, not INFO: sendPostcard is called once per recipient inside PrintOrderService's
        // batch loop, so an INFO here would write two lines per guest (rule 9). The aggregate
        // outcome is logged once by PrintOrderService ("print order finalized, succeeded/failed").
        log.debug("submitting postcard to lob, templateKey={}", req.templateKey());

        Map<String, Object> body = buildRequestBody(req);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restClient.post()
                    .uri("/postcards")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            if (response == null || response.get("id") == null) {
                throw new PrintMailException("Lob returned empty response");
            }
            String lobId = response.get("id").toString();
            // DEBUG per the batch-loop reasoning above; the provider id stays available for
            // correlation without one INFO line per recipient.
            log.debug("lob accepted postcard, lobId={}, templateKey={}", lobId, req.templateKey());
            return lobId;
        } catch (RestClientResponseException ex) {
            // Lob returns a JSON body explaining the rejection (wrong HTML dimensions, an invalid
            // ZIP, etc.). The previous version surfaced only the bare status code, which made a
            // 422 impossible to diagnose. We extract Lob's message for the couple-facing
            // per-recipient error, but log ONLY the status: Lob's message is provider-controlled
            // and an address-validation error can echo submitted address fields, which must never
            // reach the logs. The detail rides on userDetail (not the message/cause), so the
            // PrintOrderService log line that records this failure stays PII-free too.
            String lobError = extractLobError(ex.getResponseBodyAsString());
            log.warn("lob rejected postcard, status={}", ex.getStatusCode());
            throw new PrintMailException("Lob rejected postcard: " + ex.getStatusCode(), lobError, ex);
        } catch (org.springframework.web.client.RestClientException ex) {
            // Network / transport errors only (e.g. a read timeout on a slow render). WARN, not
            // ERROR: this is a recoverable per-recipient failure inside PrintOrderService's batch
            // loop, the loop continues and the order finalizes as PARTIAL_FAILURE/FAILED, so one
            // guest's transport hiccup must not page on-call (systemic outages surface via the
            // aggregate finalize line + alerting on failure rate, not one ERROR per recipient).
            // Runtime exceptions (NPE, etc.) are not caught here so they still surface as 500s
            // rather than being mis-attributed as Lob failures.
            log.warn("lob call failed, templateKey={}", req.templateKey(), ex);
            throw new PrintMailException("Lob call failed: " + ex.getMessage(), ex);
        }
    }

    // Package-private so the request contract (use_type, size, conditional mail_type) is unit
    // testable without a live Lob call; sendPostcard stays focused on the HTTP exchange.
    Map<String, Object> buildRequestBody(PostcardRequest req) {
        Map<String, Object> body = new HashMap<>();
        body.put("description", req.templateKey() + " for " + req.coupleNames());
        body.put("to", addressMap(req.to()));
        body.put("from", addressMap(req.from()));
        body.put("front", renderFront(req));
        body.put("back", renderBack(req));
        body.put("size", POSTCARD_SIZE);
        // Required by Lob on every mail piece; see MAIL_USE_TYPE for why "operational".
        body.put("use_type", MAIL_USE_TYPE);
        // usps_first_class is US-only; omit mail_type for international so Lob routes correctly
        if (isUsDomestic(req.to().country())) {
            body.put("mail_type", "usps_first_class");
        }
        return body;
    }

    private Map<String, Object> addressMap(ToAddress a) {
        Map<String, Object> m = new HashMap<>();
        m.put("name", a.name());
        m.put("address_line1", a.addressLine1());
        if (a.addressLine2() != null && !a.addressLine2().isBlank()) m.put("address_line2", a.addressLine2());
        m.put("address_city", a.city());
        // Lob rejects null keys for state/zip on domestic; omit entirely when absent (international)
        if (a.state() != null && !a.state().isBlank()) m.put("address_state", a.state());
        if (a.zip()   != null && !a.zip().isBlank())   m.put("address_zip",   a.zip());
        // Lob address_country requires ISO 3166-1 alpha-2. Normalize US variants to "US".
        m.put("address_country", isUsDomestic(a.country()) ? "US" : a.country());
        return m;
    }

    // Single source of truth for US-domestic detection. Lob's domestic postcard API requires
    // address_country="US" and mail_type="usps_first_class"; international omits both.
    private static boolean isUsDomestic(String country) {
        if (country == null || country.isBlank()) return true;
        return country.equalsIgnoreCase("US")
                || country.equalsIgnoreCase("USA")
                || country.equalsIgnoreCase("United States")
                || country.equalsIgnoreCase("United States of America");
    }

    private Map<String, Object> addressMap(FromAddress a) {
        Map<String, Object> m = new HashMap<>();
        m.put("name", a.name());
        m.put("address_line1", a.addressLine1());
        if (a.addressLine2() != null && !a.addressLine2().isBlank()) m.put("address_line2", a.addressLine2());
        m.put("address_city", a.city());
        m.put("address_state", a.state());
        m.put("address_zip", a.zip());
        m.put("address_country", "US");
        return m;
    }

    String renderFront(PostcardRequest req) {
        boolean saveTheDate = "SAVE_THE_DATE_CLASSIC".equals(req.templateKey())
                || req.templateKey().startsWith("SAVE_THE_DATE");
        String headline = saveTheDate ? "Save the Date" : "You're Invited";
        // CSS context, escape() only handles HTML entities. Single quote / backslash
        // would terminate the url('...') literal, so percent-encode them defensively.
        String safePhotoUrl = req.heroPhotoUrl() == null ? null
                : escape(req.heroPhotoUrl()).replace("\\", "%5C").replace("'", "%27");
        String photo = safePhotoUrl != null
                ? "background-image:url('" + safePhotoUrl + "');background-size:cover;background-position:center;"
                : "background:linear-gradient(135deg,#fdfaf6,#f5e9d4);";

        // Dimensions are the Lob 6x11 BLEED size (11.25in x 6.25in), NOT the 11in x 6in trim
        // (see POSTCARD_SIZE comment). The card background fills the full bleed so there is no
        // white edge after trimming; text sits inside the ~0.25in-from-bleed safe zone via the
        // .content padding and the verse offset.
        return """
                <html><head><style>
                  @page { size: 11.25in 6.25in; margin: 0; }
                  body { margin:0; font-family: Georgia, serif; width:11.25in; height:6.25in; }
                  .card { width:11.25in; height:6.25in; position:relative; %s color:#fff; text-shadow:0 2px 8px rgba(0,0,0,0.45); }
                  .overlay { position:absolute; inset:0; background:linear-gradient(180deg,rgba(0,0,0,0.15),rgba(0,0,0,0.55)); }
                  .content { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:0.7in; text-align:center; }
                  .label { font-size:14pt; letter-spacing:0.4em; text-transform:uppercase; color:#f5e9d4; margin-bottom:0.2in; }
                  .names { font-size:48pt; margin:0; font-weight:bold; }
                  .amp { font-size:32pt; color:#d4af6a; margin:0.05in 0; }
                  .date { font-size:22pt; margin-top:0.3in; }
                  .verse { position:absolute; bottom:0.4in; left:0; right:0; font-size:11pt; color:#f5e9d4; font-style:italic; }
                </style></head><body>
                  <div class="card">
                    <div class="overlay"></div>
                    <div class="content">
                      <div class="label">%s</div>
                      <div class="names">%s</div>
                      <div class="date">%s</div>
                    </div>
                    <div class="verse">"Above all, love each other deeply." - 1 Peter 4:8</div>
                  </div>
                </body></html>
                """.formatted(photo, headline, escape(req.coupleNames()), escape(req.weddingDate()));
    }

    String renderBack(PostcardRequest req) {
        String venueLine = req.venueLine() != null && !req.venueLine().isBlank()
                ? "<div style='margin-top:6pt;font-size:12pt;'>" + escape(req.venueLine()) + "</div>"
                : "";
        String url = req.weddingUrl() != null ? escape(req.weddingUrl()) : "altarwed.com";

        // Bleed size again (11.25in x 6.25in, see POSTCARD_SIZE). The left half carries our
        // message; the right half is left blank so Lob can print the recipient address block and
        // barcode there (Lob reserves the right side of the postcard back for addressing).
        return """
                <html><head><style>
                  @page { size: 11.25in 6.25in; margin: 0; }
                  body { margin:0; font-family: Georgia, serif; width:11.25in; height:6.25in; color:#3b2f2f; }
                  .left { position:absolute; left:0; top:0; width:5.5in; height:6.25in; padding:0.5in; box-sizing:border-box; background:#fdfaf6; }
                  .label { font-size:10pt; letter-spacing:0.3em; text-transform:uppercase; color:#a08060; }
                  .title { font-size:22pt; margin:0.1in 0; }
                  .body { font-size:12pt; line-height:1.6; }
                  .url { margin-top:0.4in; font-size:14pt; color:#a08060; }
                </style></head><body>
                  <div class="left">
                    <div class="label">From the desk of</div>
                    <div class="title">%s</div>
                    <div class="body">
                      We are joyfully planning our covenant wedding and would be honored
                      by your presence. Visit our wedding website for full details,
                      registry, and RSVP.
                    </div>
                    %s
                    <div class="url">%s</div>
                  </div>
                </body></html>
                """.formatted(escape(req.coupleNames()), venueLine, url);
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    /**
     * Pulls the human-readable message out of a Lob error response body, whose shape is
     * {"error":{"message":"...","status_code":422,...}}. Falls back to the raw body when the JSON
     * is missing or unparseable. Returns only error.message (never the whole body) and caps the
     * length so it always fits the print_order_recipients.error_message column (NVARCHAR(500));
     * an oversized value would abort the recipient insert with a SQL 2628 truncation error.
     */
    String extractLobError(String body) {
        if (body == null || body.isBlank()) return "no error body returned";
        String detail = null;
        try {
            JsonNode message = objectMapper.readTree(body).path("error").path("message");
            if (message.isTextual() && !message.asText().isBlank()) detail = message.asText();
        } catch (Exception ignored) {
            // not JSON, fall through to the raw body
        }
        if (detail == null) detail = body;
        return detail.length() > MAX_ERROR_DETAIL ? detail.substring(0, MAX_ERROR_DETAIL) : detail;
    }
}
