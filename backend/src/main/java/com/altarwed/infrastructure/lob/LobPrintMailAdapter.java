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

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

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

    // Lob validates the rendered HTML against the BLEED dimensions for the chosen size and returns
    // 422 UNPROCESSABLE_CONTENT on a mismatch. The bleed adds 0.125in on every edge of the trim
    // (final card), so the front and back HTML MUST render at trim + 0.25in in each axis (see the
    // @page rules in renderFront/renderBack). This bit us once: the template rendered at the 11in
    // x 6in trim size instead of the 11.25in x 6.25in bleed size and every postcard 422'd.
    //
    // The couple chooses the shape (issue: prettier + customizable cards). Each entry is the Lob
    // size string plus the exact bleed dimensions Lob's own artboard templates document:
    //   LANDSCAPE_6X11 -> 6x11, 11.25in x 6.25in (the original, proven default)
    //   PORTRAIT_6X9   -> 6x9,   6.25in x 9.25in
    //   PORTRAIT_5X7   -> 5x7,   5.25in x 7.25in
    // Ref: https://help.lob.com/print-and-mail/designing-mail-creatives/mail-piece-design-specs/postcards
    private static final CardDims DEFAULT_DIMS =
            new CardDims("6x11", "11.25in", "6.25in", false, "3.5in", "40pt", "0.55in 0.75in");

    /**
     * The Lob size string and bleed geometry for a persisted card_size value, plus a few
     * layout knobs the front template scales by shape (the bottom scrim height, the couple-names
     * font size, and the content padding). Unknown/null collapses to the proven 6x11 landscape.
     */
    private record CardDims(String lobSize, String widthIn, String heightIn, boolean portrait,
                            String scrimHeight, String namesPt, String pad) {
        String pageSize() { return widthIn + " " + heightIn; }
    }

    private static CardDims dimsFor(String cardSize) {
        if (cardSize == null) return DEFAULT_DIMS;
        return switch (cardSize.trim().toUpperCase()) {
            case "PORTRAIT_6X9" -> new CardDims("6x9", "6.25in", "9.25in", true, "3.7in", "34pt", "0.5in");
            case "PORTRAIT_5X7" -> new CardDims("5x7", "5.25in", "7.25in", true, "3.0in", "28pt", "0.4in");
            default -> DEFAULT_DIMS; // LANDSCAPE_6X11 and any unrecognized value
        };
    }

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

    @Override
    public Optional<PostcardStatusResult> fetchPostcardStatus(String providerPostcardId) {
        if (apiKey == null || apiKey.isBlank()
                || providerPostcardId == null || providerPostcardId.isBlank()) {
            return Optional.empty();
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> postcard = restClient.get()
                    .uri("/postcards/{id}", providerPostcardId)
                    .retrieve()
                    .body(Map.class);
            if (postcard == null) return Optional.empty();
            // DEBUG, not INFO: status refresh runs once per recipient inside PrintOrderService's
            // loop (rule 9), the aggregate is logged once there.
            log.debug("lob postcard status fetched, lobId={}", providerPostcardId);
            String status = deriveDeliveryStatus(postcard);
            if (status == null) return Optional.empty();
            // Issue #59 UX: surface real tracking data instead of promising a delivery guarantee
            // USPS First-Class doesn't actually offer. expected_delivery_date was already fetched
            // (deriveDeliveryStatus reads its presence) but previously discarded rather than
            // returned; tracking_number is Lob's carrier tracking number once USPS assigns one
            // (absent before the first scan, and always absent in test mode) -- both best-effort,
            // same as the status string itself.
            String trackingNumber = asNonBlankString(postcard.get("tracking_number"));
            LocalDate expectedDeliveryDate = parseLocalDate(postcard.get("expected_delivery_date"));
            return Optional.of(new PostcardStatusResult(status, trackingNumber, expectedDeliveryDate));
        } catch (RestClientResponseException ex) {
            // A 404 (unknown id) or other 4xx/5xx. Best-effort: skip this recipient, keep prior
            // status. WARN with status only (never the body, it can echo address fields).
            log.warn("lob postcard status fetch rejected, status={}", ex.getStatusCode());
            return Optional.empty();
        } catch (org.springframework.web.client.RestClientException ex) {
            log.warn("lob postcard status fetch failed (transport)", ex);
            return Optional.empty();
        }
    }

    private static String asNonBlankString(Object value) {
        if (value == null) return null;
        String s = value.toString().trim();
        return s.isEmpty() ? null : s;
    }

    private static LocalDate parseLocalDate(Object value) {
        String s = asNonBlankString(value);
        if (s == null) return null;
        try {
            // Lob returns an ISO date (occasionally with a time component); take the date part.
            return LocalDate.parse(s.length() > 10 ? s.substring(0, 10) : s);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    @Override
    public AddressVerificationResult verifyAddress(ToAddress address) {
        if (apiKey == null || apiKey.isBlank()) {
            // Fail open: an unconfigured key must not block the whole pre-payment validation
            // pass. sendPostcard already fails closed for the actual mail send, so an
            // unconfigured key never results in an uncharged/unverified postcard actually mailing.
            return new AddressVerificationResult(true, null);
        }
        log.debug("verifying address with lob");
        Map<String, Object> body = buildVerificationRequestBody(address);
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restClient.post()
                    .uri("/us_verifications")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            AddressVerificationResult result = classifyDeliverability(response);
            log.debug("lob address verification result, deliverable={}", result.deliverable());
            return result;
        } catch (RestClientResponseException ex) {
            log.warn("lob address verification rejected, status={}", ex.getStatusCode());
            return new AddressVerificationResult(true, null);
        } catch (org.springframework.web.client.RestClientException ex) {
            log.warn("lob address verification failed (transport)", ex);
            return new AddressVerificationResult(true, null);
        }
    }

    // Package-private so the request contract is unit-testable without a live Lob call, same
    // reasoning as buildRequestBody above.
    Map<String, Object> buildVerificationRequestBody(ToAddress address) {
        Map<String, Object> body = new HashMap<>();
        body.put("primary_line", address.addressLine1());
        if (address.addressLine2() != null && !address.addressLine2().isBlank()) {
            body.put("secondary_line", address.addressLine2());
        }
        body.put("city", address.city());
        body.put("state", address.state());
        body.put("zip_code", address.zip());
        return body;
    }

    // Package-private so the deliverability classification is unit-testable against a plain
    // response map, without a live Lob call. See AddressVerificationResult's javadoc for why
    // only "undeliverable" is treated as non-deliverable.
    AddressVerificationResult classifyDeliverability(Map<String, Object> response) {
        String deliverability = response == null ? null : asNonBlankString(response.get("deliverability"));
        if ("undeliverable".equals(deliverability)) {
            return new AddressVerificationResult(false,
                    "This address could not be verified as a valid USPS deliverable address.");
        }
        // deliverable, deliverable_unnecessary_unit, deliverable_incorrect_unit,
        // deliverable_missing_unit, or an unrecognized/missing value -- treat the latter as
        // fail-open (a verification-schema surprise must not block a couple's whole order; Lob's
        // own postcard-creation rejection remains the fallback safety net).
        return new AddressVerificationResult(true, null);
    }

    // Maps a Lob postcard object to a short, human-readable delivery status for the couple.
    // Lob orders tracking_events ascending by time, so the last one is the most recent USPS scan
    // (e.g. "In Transit", "Delivered", "Returned to Sender"). tracking_events is empty until USPS
    // first scans the piece (and always empty in test mode), so before any scan we fall back to
    // "Mailed" once Lob has an expected_delivery_date. Returns null when nothing is known yet, so
    // the caller leaves the existing status untouched.
    String deriveDeliveryStatus(Map<String, Object> postcard) {
        Object events = postcard.get("tracking_events");
        if (events instanceof List<?> list && !list.isEmpty()
                && list.get(list.size() - 1) instanceof Map<?, ?> latest) {
            Object name = latest.get("name");
            if (name != null && !name.toString().isBlank()) {
                String s = name.toString().trim();
                // delivery_status column is NVARCHAR(32); cap defensively.
                return s.length() > 32 ? s.substring(0, 32) : s;
            }
        }
        // expected_delivery_date is set once Lob dispatches the piece to the post office
        // but before USPS performs its first scan. Lob's dashboard calls this "Total Sent".
        Object expected = postcard.get("expected_delivery_date");
        if (expected != null && !expected.toString().isBlank()) {
            return "Sent";
        }
        return null;
    }

    // Package-private so the request contract (use_type, size, conditional mail_type) is unit
    // testable without a live Lob call; sendPostcard stays focused on the HTTP exchange.
    Map<String, Object> buildRequestBody(PostcardRequest req) {
        // Pre-compute QR once per postcard request so renderBack() is not called per recipient
        // in the batch loop with the same URL repeatedly.
        String qrBase64 = generateQrCodeBase64(req.weddingUrl() != null ? req.weddingUrl() : "https://altarwed.com");

        Map<String, Object> body = new HashMap<>();
        body.put("description", req.templateKey() + " for " + req.coupleNames());
        body.put("to", addressMap(req.to()));
        body.put("from", addressMap(req.from()));
        body.put("front", renderFront(req));
        body.put("back", renderBack(req, qrBase64));
        body.put("size", dimsFor(req.cardSize()).lobSize());
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
        CardDims dims = dimsFor(req.cardSize());
        boolean saveTheDate = req.templateKey() == null || req.templateKey().startsWith("SAVE_THE_DATE");
        String headline = saveTheDate ? "Save the Date" : "You're Invited";
        String verse = verseLine(req);

        // Only PHOTO variants use the hero image. CLASSIC variants always render the cream/gold
        // gradient regardless of whether a hero photo exists -- the template description says "no
        // photo" and couples choose Classic specifically for that.
        String safePhotoUrl = req.heroPhotoUrl() == null ? null
                : escape(req.heroPhotoUrl()).replace("\\", "%5C").replace("'", "%27");
        boolean usePhoto = safePhotoUrl != null
                && req.templateKey() != null
                && req.templateKey().endsWith("_PHOTO");

        return usePhoto
                ? renderPhotoFront(dims, headline, req, safePhotoUrl, verse)
                : renderClassicFront(dims, headline, req, verse);
    }

    // PHOTO front: names/date/verse sit in a bottom gradient band, NOT centered over the whole
    // photo, so the couple's faces (the upper portion of the hero) stay clear and unobscured
    // (family feedback: "make it so the words aren't over your beautiful faces"). The scripture
    // uses a distinct warm gold so it reads as its own line instead of blending into the names
    // ("a different color for the bible verse to see it"). Two-stop gradients only (no % stops):
    // a literal % in the CSS would collide with String.formatted's format specifiers.
    // Dimensions are the Lob BLEED size for the chosen shape (see dimsFor); the background fills
    // the full bleed so there is no white edge after trimming. charset=utf-8 prevents U+00B7
    // (middle dot in venue names) from being mis-decoded as Latin-1 mojibake.
    private String renderPhotoFront(CardDims dims, String headline, PostcardRequest req,
                                    String safePhotoUrl, String verse) {
        return """
                <html><head><meta charset="utf-8"><style>
                  @page { size: %s; margin: 0; }
                  body { margin:0; font-family: Georgia, serif; width:%s; height:%s; }
                  .card { width:%s; height:%s; position:relative; background-image:url('%s');
                          background-size:cover; background-position:center; color:#fff;
                          text-shadow:0 2px 10px rgba(0,0,0,0.6); }
                  .scrim { position:absolute; left:0; right:0; bottom:0; height:%s;
                           background:linear-gradient(to top, rgba(0,0,0,0.82), rgba(0,0,0,0)); }
                  .content { position:absolute; left:0; right:0; bottom:0; padding:%s; text-align:center; }
                  .label { font-size:13pt; letter-spacing:0.4em; text-transform:uppercase; color:#f5e9d4; margin-bottom:0.12in; }
                  .names { font-size:%s; margin:0; font-weight:bold; line-height:1.1; }
                  .date { font-size:17pt; margin-top:0.14in; }
                  .verse { font-size:11pt; color:#f0c674; font-style:italic; margin-top:0.18in; }
                </style></head><body>
                  <div class="card">
                    <div class="scrim"></div>
                    <div class="content">
                      <div class="label">%s</div>
                      <div class="names">%s</div>
                      <div class="date">%s</div>
                      <div class="verse">%s</div>
                    </div>
                  </div>
                </body></html>
                """.formatted(dims.pageSize(), dims.widthIn(), dims.heightIn(),
                        dims.widthIn(), dims.heightIn(), safePhotoUrl,
                        dims.scrimHeight(), dims.pad(), dims.namesPt(),
                        headline, escape(req.coupleNames()), escape(req.weddingDate()), verse);
    }

    // CLASSIC front: cream + gold, centered -- there are no faces to clear, so the elegant
    // centered layout stays. The scripture gets its own deeper-gold footer line so it is clearly
    // legible against the cream (same "see the verse" feedback as the photo card).
    private String renderClassicFront(CardDims dims, String headline, PostcardRequest req, String verse) {
        return """
                <html><head><meta charset="utf-8"><style>
                  @page { size: %s; margin: 0; }
                  body { margin:0; font-family: Georgia, serif; width:%s; height:%s; }
                  .card { width:%s; height:%s; position:relative;
                          background:linear-gradient(135deg,#fdfaf6,#f5e9d4); color:#3b2f2f; }
                  .content { position:absolute; inset:0; display:flex; flex-direction:column;
                             align-items:center; justify-content:center; padding:%s; text-align:center; }
                  .label { font-size:14pt; letter-spacing:0.4em; text-transform:uppercase; color:#a08060; margin-bottom:0.2in; }
                  .names { font-size:%s; margin:0; font-weight:bold; line-height:1.1; }
                  .date { font-size:20pt; margin-top:0.28in; }
                  .verse { position:absolute; bottom:0.45in; left:0; right:0; font-size:12pt; color:#9c7434; font-style:italic; }
                </style></head><body>
                  <div class="card">
                    <div class="content">
                      <div class="label">%s</div>
                      <div class="names">%s</div>
                      <div class="date">%s</div>
                    </div>
                    <div class="verse">%s</div>
                  </div>
                </body></html>
                """.formatted(dims.pageSize(), dims.widthIn(), dims.heightIn(),
                        dims.widthIn(), dims.heightIn(), dims.pad(), dims.namesPt(),
                        headline, escape(req.coupleNames()), escape(req.weddingDate()), verse);
    }

    // Longest verse we render on the front scrim band. Couples routinely enter long verses (the
    // public site even has a font-size branch for >300 chars), but the card's scrim band is fixed
    // height (tightest on PORTRAIT_5X7: 3.0in) so an unbounded verse overflows/clips the band.
    // Lob still accepts it (dimensions stay valid) -- it just prints ugly -- so cap it here.
    private static final int MAX_VERSE_CHARS = 120;

    // The couple's own verse when they picked one on their wedding website, else an AltarWed
    // default so a card never ships without scripture. Returns already-escaped, HTML-safe text.
    private static String verseLine(PostcardRequest req) {
        String text = req.verseText();
        if (text != null && !text.isBlank()) {
            String line = "\"" + escape(truncateVerse(text.trim())) + "\"";
            String ref = req.verseReference();
            if (ref != null && !ref.isBlank()) line += " - " + escape(ref.trim());
            return line;
        }
        return "\"Above all, love each other deeply.\" - 1 Peter 4:8";
    }

    // Trim an over-long verse to MAX_VERSE_CHARS at a word boundary with an ellipsis, so it fits
    // the scrim band. Truncation happens BEFORE escape() so the char budget counts real characters,
    // not entity-expanded ones (e.g. "&amp;amp;" would otherwise eat 5 chars of budget for one "&amp;").
    private static String truncateVerse(String verse) {
        if (verse.length() <= MAX_VERSE_CHARS) return verse;
        String cut = verse.substring(0, MAX_VERSE_CHARS);
        int lastSpace = cut.lastIndexOf(' ');
        if (lastSpace > MAX_VERSE_CHARS - 20) cut = cut.substring(0, lastSpace);
        return cut.stripTrailing() + "…";
    }

    String renderBack(PostcardRequest req, String qrBase64) {
        CardDims dims = dimsFor(req.cardSize());
        String venueLine = req.venueLine() != null && !req.venueLine().isBlank()
                ? "<div style='margin-top:6pt;font-size:12pt;'>" + escape(req.venueLine()) + "</div>"
                : "";
        String url = req.weddingUrl() != null ? escape(req.weddingUrl()) : "altarwed.com";

        String qrHtml = qrBase64 != null
                ? "<div class=\"qr\"><img src=\"data:image/png;base64," + qrBase64
                        + "\" alt=\"Scan for wedding website\" /><p class=\"qr-label\">Scan to visit our site</p></div>"
                : "";

        return dims.portrait()
                ? renderPortraitBack(dims, req, venueLine, url, qrHtml)
                : renderLandscapeBack(dims, req, venueLine, url, qrHtml);
    }

    // LANDSCAPE back: the left half carries our message; the right half is left blank so Lob can
    // print the recipient address block + barcode there (Lob reserves the right side of a
    // landscape postcard back for addressing). Bleed dimensions per dimsFor. charset=utf-8 --
    // same U+00B7 mojibake reason as the front.
    private String renderLandscapeBack(CardDims dims, PostcardRequest req, String venueLine, String url, String qrHtml) {
        return """
                <html><head><meta charset="utf-8"><style>
                  @page { size: %s; margin: 0; }
                  body { margin:0; font-family: Georgia, serif; width:%s; height:%s; color:#3b2f2f; }
                  .left { position:absolute; left:0; top:0; width:5.5in; height:%s; padding:0.5in; box-sizing:border-box; background:#fdfaf6; }
                  .label { font-size:10pt; letter-spacing:0.3em; text-transform:uppercase; color:#a08060; }
                  .title { font-size:22pt; margin:0.1in 0; }
                  .body { font-size:12pt; line-height:1.6; }
                  .url { margin-top:0.4in; font-size:14pt; color:#a08060; }
                  .qr { margin-top:0.25in; }
                  .qr img { width:1.1in; height:1.1in; display:block; }
                  .qr-label { font-size:9pt; color:#a08060; margin:3pt 0 0; }
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
                    %s
                  </div>
                </body></html>
                """.formatted(dims.pageSize(), dims.widthIn(), dims.heightIn(),
                        dims.heightIn(), escape(req.coupleNames()), venueLine, url, qrHtml);
    }

    // PORTRAIT back: USPS/Lob place the recipient address block + barcode along the BOTTOM of a
    // portrait postcard back, so our message + QR go in a top band and the lower ~55% is left
    // blank for Lob to address. Keeping the message strictly in the top band leaves a generous
    // ink-free zone below. NOTE: portrait sizes need one live Lob test-mode send verified before
    // prod use (the address zone can't be asserted in a unit test) -- see the PR's manual steps.
    private String renderPortraitBack(CardDims dims, PostcardRequest req, String venueLine, String url, String qrHtml) {
        String topHeight = "5x7".equals(dims.lobSize()) ? "3.2in" : "4.2in";
        return """
                <html><head><meta charset="utf-8"><style>
                  @page { size: %s; margin: 0; }
                  body { margin:0; font-family: Georgia, serif; width:%s; height:%s; color:#3b2f2f; }
                  .top { position:absolute; left:0; top:0; right:0; height:%s; padding:0.45in 0.5in; box-sizing:border-box; background:#fdfaf6; }
                  .label { font-size:10pt; letter-spacing:0.3em; text-transform:uppercase; color:#a08060; }
                  .title { font-size:20pt; margin:0.08in 0; }
                  .body { font-size:11pt; line-height:1.5; }
                  .url { margin-top:0.16in; font-size:13pt; color:#a08060; }
                  .qr { margin-top:0.16in; }
                  .qr img { width:0.95in; height:0.95in; display:block; }
                  .qr-label { font-size:8pt; color:#a08060; margin:3pt 0 0; }
                </style></head><body>
                  <div class="top">
                    <div class="label">From the desk of</div>
                    <div class="title">%s</div>
                    <div class="body">
                      We are joyfully planning our covenant wedding and would be
                      honored by your presence. Visit our wedding website for
                      full details, registry, and RSVP.
                    </div>
                    %s
                    <div class="url">%s</div>
                    %s
                  </div>
                </body></html>
                """.formatted(dims.pageSize(), dims.widthIn(), dims.heightIn(),
                        topHeight, escape(req.coupleNames()), venueLine, url, qrHtml);
    }

    private String generateQrCodeBase64(String url) {
        try {
            Map<EncodeHintType, Object> hints = new HashMap<>();
            hints.put(EncodeHintType.MARGIN, 1);
            BitMatrix matrix = new MultiFormatWriter().encode(url, BarcodeFormat.QR_CODE, 300, 300, hints);
            BufferedImage image = MatrixToImageWriter.toBufferedImage(matrix);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(image, "PNG", out);
            return Base64.getEncoder().encodeToString(out.toByteArray());
        } catch (Throwable e) {
            // Catch Throwable (not just Exception) because AWT/headless init failures on Linux
            // throw NoClassDefFoundError / UnsatisfiedLinkError -- both are Errors, not Exceptions.
            // QR is best-effort: a failure skips the QR but must not break the postcard send.
            log.warn("qr code generation failed, url={}", url, e);
            return null;
        }
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
