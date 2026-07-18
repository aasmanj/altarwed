package com.altarwed.infrastructure.lob;

import com.altarwed.domain.model.PrintOverlayTextTheme;
import com.altarwed.domain.model.PrintTemplate;
import com.altarwed.domain.model.PrintTextPosition;
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
        // Issue #362: templateKey may carry a PHOTO overlay suffix (~position~theme). Parse it once
        // through the domain allowlist so the layout branch, headline, and photo-overlay knobs all
        // read from the same validated source instead of substring-matching the raw key.
        PrintTemplate.Parsed parsed = PrintTemplate.parse(req.templateKey());
        // A null parse means the key was not on the allowlist. PrintOrderService rejects those long
        // before the async Lob batch builds a PostcardRequest, so this only guards a direct call
        // with a bad key: fall back to the classic save-the-date layout rather than NPE.
        String base = parsed != null ? parsed.baseKey() : "SAVE_THE_DATE_CLASSIC";
        boolean saveTheDate = base.startsWith("SAVE_THE_DATE");
        String headline = saveTheDate ? "Save the Date" : "You're Invited";
        String verse = verseLine(req);
        String accent = sanitizeAccent(req.accentColor());

        // Only PHOTO variants use the hero image. The other styles always render their own
        // background regardless of whether a hero photo exists -- couples pick those specifically
        // for a no-photo card.
        String safePhotoUrl = req.heroPhotoUrl() == null ? null
                : escape(req.heroPhotoUrl()).replace("\\", "%5C").replace("'", "%27");
        boolean usePhoto = safePhotoUrl != null && base.endsWith("_PHOTO");

        if (usePhoto) {
            PrintTextPosition position = parsed.position() != null ? parsed.position() : PrintTextPosition.DEFAULT;
            PrintOverlayTextTheme theme = parsed.theme() != null ? parsed.theme() : PrintOverlayTextTheme.DEFAULT;
            return renderPhotoFront(dims, headline, req, safePhotoUrl, verse, position, theme);
        }
        // Non-photo styles share the centered layout family but differ in palette/ornament. A PHOTO
        // base with no hero photo falls through to CLASSIC (a photo card must never render a blank
        // hero); the frontend blocks paying for a photo card without a photo, so this is defensive.
        return switch (styleOf(base)) {
            case "MINIMAL" -> renderMinimalFront(dims, headline, req, verse, accent);
            case "BOTANICAL" -> renderBotanicalFront(dims, headline, req, verse, accent);
            case "DARK_ELEGANT" -> renderDarkElegantFront(dims, headline, req, verse, accent);
            default -> renderClassicFront(dims, headline, req, verse, accent);
        };
    }

    // The style token after the {SAVE_THE_DATE|INVITATION}_ prefix (CLASSIC, PHOTO, MINIMAL,
    // BOTANICAL, DARK_ELEGANT). Anything unexpected collapses to CLASSIC.
    private static String styleOf(String base) {
        if (base.startsWith("SAVE_THE_DATE_")) return base.substring("SAVE_THE_DATE_".length());
        if (base.startsWith("INVITATION_")) return base.substring("INVITATION_".length());
        return "CLASSIC";
    }

    // The accent used on the non-photo templates, sourced from the couple's website accentColor.
    // Default is the original gold, so an unset/legacy accent renders exactly as before.
    private static final String DEFAULT_ACCENT = "#a08060";

    // accentColor is couple-controlled and gets interpolated straight into inline card CSS, so it
    // must be validated to a strict hex literal (#RGB / #RRGGBB / #RRGGBBAA) before use. Anything
    // else (a CSS keyword, a url(), an unclosed value, null) collapses to the default gold rather
    // than letting arbitrary text reach the style attribute.
    private static String sanitizeAccent(String accent) {
        if (accent == null) return DEFAULT_ACCENT;
        String a = accent.trim();
        return a.matches("#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})") ? a : DEFAULT_ACCENT;
    }

    // Small palette knobs the PHOTO overlay computes from the chosen text position + light/dark
    // theme. Kept as one record so renderPhotoFront stays a single formatted template.
    private record PhotoOverlay(String cardColor, String cardShadow, String scrimCss,
                                String contentAnchor, String textAlign,
                                String labelColor, String verseColor) {}

    // Issue #362: the couple's 3x3 position + light/dark toggle become concrete CSS here. LIGHT is
    // light type over a dark scrim (the proven default); DARK is dark type over a light scrim for a
    // bright photo. The scrim is anchored to the same edge the text is (top band, centered veil, or
    // bottom band) so the couple's faces stay clear wherever the text sits. Two-stop gradients only
    // (no % stops): a literal % would collide with String.formatted's specifiers.
    private static PhotoOverlay photoOverlay(CardDims dims, PrintTextPosition position, PrintOverlayTextTheme theme) {
        boolean light = theme != PrintOverlayTextTheme.DARK;
        String cardColor = light ? "#fff" : "#2a2018";
        String cardShadow = light ? "0 2px 10px rgba(0,0,0,0.6)" : "0 1px 6px rgba(255,255,255,0.55)";
        String labelColor = light ? "#f5e9d4" : "#5b4a34";
        String verseColor = light ? "#f0c674" : "#7a531c";
        String strong = light ? "rgba(0,0,0,0.82)" : "rgba(255,255,255,0.85)";
        String fade = light ? "rgba(0,0,0,0)" : "rgba(255,255,255,0)";
        String veil = light ? "rgba(0,0,0,0.42)" : "rgba(255,255,255,0.5)";

        String scrimCss;
        String contentAnchor;
        if (position.isTop()) {
            scrimCss = "position:absolute; left:0; right:0; top:0; height:" + dims.scrimHeight()
                    + "; background:linear-gradient(to bottom, " + strong + ", " + fade + ");";
            contentAnchor = "left:0; right:0; top:0;";
        } else if (position.isMiddle()) {
            scrimCss = "position:absolute; left:0; right:0; top:0; bottom:0; background:" + veil + ";";
            contentAnchor = "left:0; right:0; top:0; bottom:0; display:flex; flex-direction:column; justify-content:center;";
        } else {
            // BOTTOM (default): keep the exact anchor the original card used so nothing regresses.
            scrimCss = "position:absolute; left:0; right:0; bottom:0; height:" + dims.scrimHeight()
                    + "; background:linear-gradient(to top, " + strong + ", " + fade + ");";
            contentAnchor = "left:0; right:0; bottom:0;";
        }
        String textAlign = position.isLeft() ? "left" : position.isRight() ? "right" : "center";
        return new PhotoOverlay(cardColor, cardShadow, scrimCss, contentAnchor, textAlign, labelColor, verseColor);
    }

    // PHOTO front: names/date/verse sit in a scrim band anchored to the couple's chosen position
    // (issue #362), NOT centered over the whole photo by default, so the couple's faces stay clear
    // and unobscured (family feedback: "make it so the words aren't over your beautiful faces").
    // The scripture keeps a distinct warm color so it reads as its own line instead of blending
    // into the names ("a different color for the bible verse to see it").
    // Dimensions are the Lob BLEED size for the chosen shape (see dimsFor); the background fills
    // the full bleed so there is no white edge after trimming. charset=utf-8 prevents U+00B7
    // (middle dot in venue names) from being mis-decoded as Latin-1 mojibake.
    private String renderPhotoFront(CardDims dims, String headline, PostcardRequest req,
                                    String safePhotoUrl, String verse,
                                    PrintTextPosition position, PrintOverlayTextTheme theme) {
        PhotoOverlay o = photoOverlay(dims, position, theme);
        return """
                <html><head><meta charset="utf-8"><style>
                  @page { size: %s; margin: 0; }
                  body { margin:0; font-family: Georgia, serif; width:%s; height:%s; }
                  .card { width:%s; height:%s; position:relative; background-image:url('%s');
                          background-size:cover; background-position:center; color:%s;
                          text-shadow:%s; }
                  .scrim { %s }
                  .content { position:absolute; %s padding:%s; text-align:%s; }
                  .label { font-size:13pt; letter-spacing:0.4em; text-transform:uppercase; color:%s; margin-bottom:0.12in; }
                  .names { font-size:%s; margin:0; font-weight:bold; line-height:1.1; }
                  .date { font-size:17pt; margin-top:0.14in; }
                  .verse { font-size:11pt; color:%s; font-style:italic; margin-top:0.18in; }
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
                        o.cardColor(), o.cardShadow(), o.scrimCss(), o.contentAnchor(), dims.pad(), o.textAlign(),
                        o.labelColor(), dims.namesPt(), o.verseColor(),
                        headline, escape(req.coupleNames()), escape(req.weddingDate()), verse);
    }

    // CLASSIC front: cream + gold, centered -- there are no faces to clear, so the elegant
    // centered layout stays. The eyebrow label and a thin rule under the names carry the couple's
    // accent (issue #362); the scripture keeps its deeper-gold footer line for legibility on cream.
    private String renderClassicFront(CardDims dims, String headline, PostcardRequest req, String verse, String accent) {
        return """
                <html><head><meta charset="utf-8"><style>
                  @page { size: %s; margin: 0; }
                  body { margin:0; font-family: Georgia, serif; width:%s; height:%s; }
                  .card { width:%s; height:%s; position:relative;
                          background:linear-gradient(135deg,#fdfaf6,#f5e9d4); color:#3b2f2f; }
                  .content { position:absolute; inset:0; display:flex; flex-direction:column;
                             align-items:center; justify-content:center; padding:%s; text-align:center; }
                  .label { font-size:14pt; letter-spacing:0.4em; text-transform:uppercase; color:%s; margin-bottom:0.2in; }
                  .names { font-size:%s; margin:0; font-weight:bold; line-height:1.1; }
                  .rule { width:1.6in; height:2px; margin:0.18in auto 0; background:%s; }
                  .date { font-size:20pt; margin-top:0.24in; }
                  .verse { position:absolute; bottom:0.45in; left:0; right:0; font-size:12pt; color:#9c7434; font-style:italic; }
                </style></head><body>
                  <div class="card">
                    <div class="content">
                      <div class="label">%s</div>
                      <div class="names">%s</div>
                      <div class="rule"></div>
                      <div class="date">%s</div>
                    </div>
                    <div class="verse">%s</div>
                  </div>
                </body></html>
                """.formatted(dims.pageSize(), dims.widthIn(), dims.heightIn(),
                        dims.widthIn(), dims.heightIn(), dims.pad(), accent, dims.namesPt(), accent,
                        headline, escape(req.coupleNames()), escape(req.weddingDate()), verse);
    }

    // MINIMAL front (issue #362): a lot of white space, a hairline accent frame, and a thin accent
    // rule under the names. No gradient, no ornament -- the accent is the only color, so a couple's
    // accentColor is unmistakably what drives the look.
    private String renderMinimalFront(CardDims dims, String headline, PostcardRequest req, String verse, String accent) {
        return """
                <html><head><meta charset="utf-8"><style>
                  @page { size: %s; margin: 0; }
                  body { margin:0; font-family: Georgia, serif; width:%s; height:%s; }
                  .card { width:%s; height:%s; position:relative; background:#ffffff; color:#2b2b2b; }
                  .frame { position:absolute; inset:0.28in; border:1px solid %s; }
                  .content { position:absolute; inset:0; display:flex; flex-direction:column;
                             align-items:center; justify-content:center; padding:%s; text-align:center; }
                  .label { font-size:11pt; letter-spacing:0.5em; text-transform:uppercase; color:%s; margin-bottom:0.22in; }
                  .names { font-size:%s; margin:0; font-weight:normal; line-height:1.15; letter-spacing:0.02em; }
                  .rule { width:1.1in; height:1px; margin:0.2in auto; background:%s; }
                  .date { font-size:15pt; letter-spacing:0.2em; text-transform:uppercase; color:#555; }
                  .verse { position:absolute; bottom:0.5in; left:0; right:0; font-size:11pt; color:#8a6a4a; font-style:italic; }
                </style></head><body>
                  <div class="card">
                    <div class="frame"></div>
                    <div class="content">
                      <div class="label">%s</div>
                      <div class="names">%s</div>
                      <div class="rule"></div>
                      <div class="date">%s</div>
                    </div>
                    <div class="verse">%s</div>
                  </div>
                </body></html>
                """.formatted(dims.pageSize(), dims.widthIn(), dims.heightIn(),
                        dims.widthIn(), dims.heightIn(), accent, dims.pad(), accent, dims.namesPt(), accent,
                        headline, escape(req.coupleNames()), escape(req.weddingDate()), verse);
    }

    // BOTANICAL front (issue #362): a warm ivory card with a double accent border frame and accent
    // corner ticks standing in for a botanical wreath, plus the accent eyebrow. Keeps the couple's
    // accent front and center while reading softer and more organic than CLASSIC.
    private String renderBotanicalFront(CardDims dims, String headline, PostcardRequest req, String verse, String accent) {
        return """
                <html><head><meta charset="utf-8"><style>
                  @page { size: %s; margin: 0; }
                  body { margin:0; font-family: Georgia, serif; width:%s; height:%s; }
                  .card { width:%s; height:%s; position:relative; background:#f7f3ea; color:#33413a; }
                  .frame { position:absolute; inset:0.24in; border:2px solid %s; }
                  .frame2 { position:absolute; inset:0.34in; border:1px solid %s; opacity:0.55; }
                  .content { position:absolute; inset:0; display:flex; flex-direction:column;
                             align-items:center; justify-content:center; padding:%s; text-align:center; }
                  .label { font-size:12pt; letter-spacing:0.42em; text-transform:uppercase; color:%s; margin-bottom:0.2in; }
                  .names { font-size:%s; margin:0; font-weight:bold; line-height:1.1; }
                  .sprig { color:%s; font-size:16pt; margin:0.14in 0 0.06in; letter-spacing:0.3em; }
                  .date { font-size:18pt; margin-top:0.06in; color:#4a5a4a; }
                  .verse { position:absolute; bottom:0.46in; left:0; right:0; font-size:12pt; color:#5a7a55; font-style:italic; }
                </style></head><body>
                  <div class="card">
                    <div class="frame"></div>
                    <div class="frame2"></div>
                    <div class="content">
                      <div class="label">%s</div>
                      <div class="names">%s</div>
                      <div class="sprig">&#8901; &#10047; &#8901;</div>
                      <div class="date">%s</div>
                    </div>
                    <div class="verse">%s</div>
                  </div>
                </body></html>
                """.formatted(dims.pageSize(), dims.widthIn(), dims.heightIn(),
                        dims.widthIn(), dims.heightIn(), accent, accent, dims.pad(), accent, dims.namesPt(), accent,
                        headline, escape(req.coupleNames()), escape(req.weddingDate()), verse);
    }

    // DARK ELEGANT front (issue #362): deep charcoal card with light cream type and the couple's
    // accent as the eyebrow + divider. The dramatic dark palette is the point; the accent keeps it
    // personal. Verse in a soft gold so it stays legible on the dark ground.
    private String renderDarkElegantFront(CardDims dims, String headline, PostcardRequest req, String verse, String accent) {
        return """
                <html><head><meta charset="utf-8"><style>
                  @page { size: %s; margin: 0; }
                  body { margin:0; font-family: Georgia, serif; width:%s; height:%s; }
                  .card { width:%s; height:%s; position:relative;
                          background:linear-gradient(150deg,#241f1b,#12100e); color:#f3ece0; }
                  .content { position:absolute; inset:0; display:flex; flex-direction:column;
                             align-items:center; justify-content:center; padding:%s; text-align:center; }
                  .label { font-size:13pt; letter-spacing:0.46em; text-transform:uppercase; color:%s; margin-bottom:0.2in; }
                  .names { font-size:%s; margin:0; font-weight:bold; line-height:1.1; }
                  .rule { width:1.5in; height:2px; margin:0.18in auto 0; background:%s; }
                  .date { font-size:19pt; margin-top:0.22in; color:#d8ccb8; }
                  .verse { position:absolute; bottom:0.45in; left:0; right:0; font-size:12pt; color:#d9b877; font-style:italic; }
                </style></head><body>
                  <div class="card">
                    <div class="content">
                      <div class="label">%s</div>
                      <div class="names">%s</div>
                      <div class="rule"></div>
                      <div class="date">%s</div>
                    </div>
                    <div class="verse">%s</div>
                  </div>
                </body></html>
                """.formatted(dims.pageSize(), dims.widthIn(), dims.heightIn(),
                        dims.widthIn(), dims.heightIn(), dims.pad(), accent, dims.namesPt(), accent,
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
        // Issue #362: carry the couple's accent onto the back's label/url/QR caption too, so the
        // whole card reads as one accented set. Defaults to the original gold when unset.
        String accent = sanitizeAccent(req.accentColor());

        String qrHtml = qrBase64 != null
                ? "<div class=\"qr\"><img src=\"data:image/png;base64," + qrBase64
                        + "\" alt=\"Scan for wedding website\" /><p class=\"qr-label\">Scan to visit our site</p></div>"
                : "";

        return dims.portrait()
                ? renderPortraitBack(dims, req, venueLine, url, qrHtml, accent)
                : renderLandscapeBack(dims, req, venueLine, url, qrHtml, accent);
    }

    // LANDSCAPE back: the left half carries our message; the right half is left blank so Lob can
    // print the recipient address block + barcode there (Lob reserves the right side of a
    // landscape postcard back for addressing). Bleed dimensions per dimsFor. charset=utf-8 --
    // same U+00B7 mojibake reason as the front.
    private String renderLandscapeBack(CardDims dims, PostcardRequest req, String venueLine, String url, String qrHtml, String accent) {
        return """
                <html><head><meta charset="utf-8"><style>
                  @page { size: %s; margin: 0; }
                  body { margin:0; font-family: Georgia, serif; width:%s; height:%s; color:#3b2f2f; }
                  .left { position:absolute; left:0; top:0; width:5.5in; height:%s; padding:0.5in; box-sizing:border-box; background:#fdfaf6; }
                  .label { font-size:10pt; letter-spacing:0.3em; text-transform:uppercase; color:%s; }
                  .title { font-size:22pt; margin:0.1in 0; }
                  .body { font-size:12pt; line-height:1.6; }
                  .url { margin-top:0.4in; font-size:14pt; color:%s; }
                  .qr { margin-top:0.25in; }
                  .qr img { width:1.1in; height:1.1in; display:block; }
                  .qr-label { font-size:9pt; color:%s; margin:3pt 0 0; }
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
                        dims.heightIn(), accent, accent, accent, escape(req.coupleNames()), venueLine, url, qrHtml);
    }

    // PORTRAIT back: USPS/Lob place the recipient address block + barcode along the BOTTOM of a
    // portrait postcard back, so our message + QR go in a top band and the lower ~55% is left
    // blank for Lob to address. Keeping the message strictly in the top band leaves a generous
    // ink-free zone below. NOTE: portrait sizes need one live Lob test-mode send verified before
    // prod use (the address zone can't be asserted in a unit test) -- see the PR's manual steps.
    private String renderPortraitBack(CardDims dims, PostcardRequest req, String venueLine, String url, String qrHtml, String accent) {
        String topHeight = "5x7".equals(dims.lobSize()) ? "3.2in" : "4.2in";
        return """
                <html><head><meta charset="utf-8"><style>
                  @page { size: %s; margin: 0; }
                  body { margin:0; font-family: Georgia, serif; width:%s; height:%s; color:#3b2f2f; }
                  .top { position:absolute; left:0; top:0; right:0; height:%s; padding:0.45in 0.5in; box-sizing:border-box; background:#fdfaf6; }
                  .label { font-size:10pt; letter-spacing:0.3em; text-transform:uppercase; color:%s; }
                  .title { font-size:20pt; margin:0.08in 0; }
                  .body { font-size:11pt; line-height:1.5; }
                  .url { margin-top:0.16in; font-size:13pt; color:%s; }
                  .qr { margin-top:0.16in; }
                  .qr img { width:0.95in; height:0.95in; display:block; }
                  .qr-label { font-size:8pt; color:%s; margin:3pt 0 0; }
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
                        topHeight, accent, accent, accent, escape(req.coupleNames()), venueLine, url, qrHtml);
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
