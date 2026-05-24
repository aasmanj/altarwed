package com.altarwed.infrastructure.lob;

import com.altarwed.domain.port.PrintMailPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
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

    private final String apiKey;
    private final RestClient restClient;

    public LobPrintMailAdapter(@Value("${altarwed.lob.api-key:}") String apiKey) {
        this.apiKey = apiKey;
        String basic = Base64.getEncoder().encodeToString((apiKey + ":").getBytes(StandardCharsets.UTF_8));
        this.restClient = RestClient.builder()
                .baseUrl("https://api.lob.com/v1")
                .defaultHeader("Authorization", "Basic " + basic)
                .build();
    }

    @Override
    public String sendPostcard(PostcardRequest req) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new PrintMailException("Lob API key not configured. Set LOB_API_KEY env var.");
        }

        String front = renderFront(req);
        String back = renderBack(req);

        Map<String, Object> body = new HashMap<>();
        body.put("description", req.templateKey() + " for " + req.coupleNames());
        body.put("to", addressMap(req.to()));
        body.put("from", addressMap(req.from()));
        body.put("front", front);
        body.put("back", back);
        body.put("size", "6x11");
        body.put("mail_type", "usps_first_class");

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
            return response.get("id").toString();
        } catch (RestClientResponseException ex) {
            log.warn("Lob rejected postcard for {}: {} {}", req.to().name(), ex.getStatusCode(), ex.getResponseBodyAsString());
            throw new PrintMailException("Lob rejected postcard: " + ex.getStatusCode() + " " + ex.getResponseBodyAsString(), ex);
        } catch (org.springframework.web.client.RestClientException ex) {
            // Network / transport errors only. Let runtime exceptions (NPE, etc.) propagate
            // so they surface as 500s rather than being mis-attributed as Lob failures.
            throw new PrintMailException("Lob call failed: " + ex.getMessage(), ex);
        }
    }

    private Map<String, Object> addressMap(ToAddress a) {
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

    private String renderFront(PostcardRequest req) {
        boolean saveTheDate = "SAVE_THE_DATE_CLASSIC".equals(req.templateKey())
                || req.templateKey().startsWith("SAVE_THE_DATE");
        String headline = saveTheDate ? "Save the Date" : "You're Invited";
        // CSS context — escape() only handles HTML entities. Single quote / backslash
        // would terminate the url('...') literal, so percent-encode them defensively.
        String safePhotoUrl = req.heroPhotoUrl() == null ? null
                : escape(req.heroPhotoUrl()).replace("\\", "%5C").replace("'", "%27");
        String photo = safePhotoUrl != null
                ? "background-image:url('" + safePhotoUrl + "');background-size:cover;background-position:center;"
                : "background:linear-gradient(135deg,#fdfaf6,#f5e9d4);";

        return """
                <html><head><style>
                  @page { size: 11in 6in; margin: 0; }
                  body { margin:0; font-family: Georgia, serif; width:11in; height:6in; }
                  .card { width:11in; height:6in; position:relative; %s color:#fff; text-shadow:0 2px 8px rgba(0,0,0,0.45); }
                  .overlay { position:absolute; inset:0; background:linear-gradient(180deg,rgba(0,0,0,0.15),rgba(0,0,0,0.55)); }
                  .content { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:0.6in; text-align:center; }
                  .label { font-size:14pt; letter-spacing:0.4em; text-transform:uppercase; color:#f5e9d4; margin-bottom:0.2in; }
                  .names { font-size:48pt; margin:0; font-weight:bold; }
                  .amp { font-size:32pt; color:#d4af6a; margin:0.05in 0; }
                  .date { font-size:22pt; margin-top:0.3in; }
                  .verse { position:absolute; bottom:0.3in; left:0; right:0; font-size:11pt; color:#f5e9d4; font-style:italic; }
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

    private String renderBack(PostcardRequest req) {
        String venueLine = req.venueLine() != null && !req.venueLine().isBlank()
                ? "<div style='margin-top:6pt;font-size:12pt;'>" + escape(req.venueLine()) + "</div>"
                : "";
        String url = req.weddingUrl() != null ? escape(req.weddingUrl()) : "altarwed.com";

        return """
                <html><head><style>
                  @page { size: 11in 6in; margin: 0; }
                  body { margin:0; font-family: Georgia, serif; width:11in; height:6in; color:#3b2f2f; }
                  .left { position:absolute; left:0; top:0; width:5.5in; height:6in; padding:0.5in; box-sizing:border-box; background:#fdfaf6; }
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
}
