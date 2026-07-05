package com.altarwed.infrastructure.email;

import com.altarwed.application.service.EmailSuppressionService;
import com.altarwed.domain.model.EmailAddresses;
import com.altarwed.domain.model.EmailRecipient;
import com.altarwed.domain.port.EmailPort;
import com.altarwed.domain.port.EmailSuppressionPort;
import com.altarwed.infrastructure.observability.LogSanitizer;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class ResendEmailAdapter implements EmailPort {

    private static final Logger log = LoggerFactory.getLogger(ResendEmailAdapter.class);

    private final RestClient restClient;
    private final String fromEmail;
    // Guest-facing invite mail (save-the-dates, RSVP invites) sends From this address,
    // a dedicated subdomain (e.g. hello@invites.altarwed.com) so the bulk invite stream's
    // deliverability reputation is isolated from transactional/system mail on the root
    // domain. Defaults to fromEmail until the subdomain is verified (see application.yml).
    private final String invitesFromEmail;
    private final String appBaseUrl;
    private final String publicBaseUrl;
    private final String apiBaseUrl;
    private final String unsubscribeSecret;
    private final String postalAddress;
    private final String adminAlertEmail;
    private final EmailSuppressionPort suppressionPort;

    // Shared token bucket that paces ALL outbound Resend calls (every email type)
    // so a bulk send (e.g. 200 save-the-dates fired concurrently on emailExecutor)
    // stays under Resend's account limit of 5 requests/second. Without this the
    // pool blasts every email at once, Resend returns 429, and the surplus mail is
    // silently dropped. Same in-memory-per-instance caveat as RateLimitingFilter:
    // with multiple App Service instances the effective rate is rate x instanceCount,
    // so keep the default comfortably under the provider limit.
    private final Bucket resendRateLimiter;

    // A 429 means we momentarily outran the limit (a burst, or another instance's
    // traffic). Retry with backoff so the email is delivered rather than lost.
    private static final int MAX_SEND_ATTEMPTS = 4;

    // Resend's /emails/batch endpoint accepts up to 100 messages per call.
    private static final int MAX_BATCH_SIZE = 100;

    public ResendEmailAdapter(
            @Value("${altarwed.resend.api-key}") String apiKey,
            @Value("${altarwed.resend.from-email}") String fromEmail,
            @Value("${altarwed.resend.invites-from-email}") String invitesFromEmail,
            @Value("${altarwed.app.base-url}") String appBaseUrl,
            @Value("${altarwed.api.base-url}") String apiBaseUrl,
            @Value("${altarwed.unsubscribe.secret}") String unsubscribeSecret,
            @Value("${altarwed.postal-address}") String postalAddress,
            @Value("${altarwed.admin.alert-email:hello@altarwed.com}") String adminAlertEmail,
            @Value("${altarwed.resend.rate-limit-per-second:2}") int rateLimitPerSecond,
            EmailSuppressionPort suppressionPort
    ) {
        this.fromEmail = fromEmail;
        this.invitesFromEmail = invitesFromEmail;
        this.appBaseUrl = appBaseUrl;
        this.publicBaseUrl = appBaseUrl.replace("app.", "www.");
        this.apiBaseUrl = apiBaseUrl;
        this.unsubscribeSecret = unsubscribeSecret;
        this.postalAddress = postalAddress;
        this.adminAlertEmail = adminAlertEmail;
        this.suppressionPort = suppressionPort;
        // Prod-visible signal for whether the guest-invite stream is actually isolated.
        // When RESEND_INVITES_FROM_EMAIL is unset, the nested placeholder falls through to
        // the root from-email and invites silently ride the root domain (today's behaviour,
        // not an error, hence WARN not ERROR). Without this line the logs give no indication
        // the deliverability isolation is off. Matches env-var rule #1 (warn when a
        // critical-but-not-fatal var is effectively unset). The address itself is system
        // config, not user PII, but we log only the condition to stay clear of the rule.
        if (invitesFromEmail.equals(fromEmail)) {
            log.warn("invite mail stream not isolated, invitesFromEmail equals fromEmail; "
                    + "guest invites send from the root domain (set RESEND_INVITES_FROM_EMAIL "
                    + "to the verified invite subdomain to isolate invite deliverability)");
        }
        // Clamp to >= 1 so a fat-fingered env value (0, negative) degrades to a slow
        // trickle instead of bricking the JVM at startup (Bucket4j rejects capacity < 1),
        // the exact startup-crash failure mode documented in backend/CLAUDE.md.
        int safeRate = Math.max(1, rateLimitPerSecond);
        // capacity == refill rate, so the burst ceiling equals the steady rate:
        // no big initial spike that would trip the provider limit on the first batch.
        Bandwidth limit = Bandwidth.builder()
                .capacity(safeRate)
                .refillGreedy(safeRate, Duration.ofSeconds(1))
                .build();
        this.resendRateLimiter = Bucket.builder().addLimit(limit).build();
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(15));
        this.restClient = RestClient.builder()
                .requestFactory(factory)
                .baseUrl("https://api.resend.com")
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .build();
    }

    // Produces two URLs for each unsubscribe link:
    // - displayUrl: the Next.js /unsubscribe page (human-readable, shown in email footer)
    // - oneClickUrl: the backend API endpoint (RFC 8058 one-click POST target for Gmail/Yahoo)
    // The List-Unsubscribe header must point at the backend because email clients POST
    // directly to it with no browser; Next.js page routes only handle GET.
    // Guest-facing mail passes the sending couple so the unsubscribe is scoped to THAT
    // wedding (per-couple opt-out). Couple-facing mail (welcome) passes null, yielding a
    // legacy global opt-out link, the same format links already in inboxes use.
    private String unsubscribeDisplayUrl(String toEmail, UUID coupleId) {
        String hash = emailHash(toEmail);
        return publicBaseUrl + "/unsubscribe?h=" + hash + coupleParam(coupleId) + "&tok=" + hmacToken(hash, coupleId);
    }

    private String unsubscribeOneClickUrl(String toEmail, UUID coupleId) {
        String hash = emailHash(toEmail);
        return apiBaseUrl + "/api/v1/unsubscribe?h=" + hash + coupleParam(coupleId) + "&tok=" + hmacToken(hash, coupleId);
    }

    private static String coupleParam(UUID coupleId) {
        return coupleId == null ? "" : "&c=" + coupleId;
    }

    private static String emailHash(String email) {
        return EmailSuppressionService.emailHash(email);
    }

    private String hmacToken(String emailHash, UUID coupleId) {
        try {
            // Single source of the signed-payload format (shared with the verifier) so the
            // minted link and the verification can never drift apart.
            String payload = EmailSuppressionService.unsubscribeTokenPayload(emailHash, coupleId);
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(unsubscribeSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException | InvalidKeyException ex) {
            throw new IllegalStateException("HmacSHA256 not available", ex);
        }
    }

    private String unsubscribeFooterHtml(String unsubUrl) {
        return """
                <div style="margin-top:32px;border-top:1px solid #e8dcc8;padding-top:16px;text-align:center;color:#a08060;font-size:11px;font-family:sans-serif;">
                  You received this because you were added to an AltarWed wedding.<br>
                  <a href="%s" style="color:#a08060;">Unsubscribe</a> &nbsp;|&nbsp; %s
                </div>
                """.formatted(unsubUrl, postalAddress);
    }

    private String unsubscribeFooterText(String unsubUrl) {
        return "\n\nTo unsubscribe: " + unsubUrl + "\n" + postalAddress;
    }

    // The growth CTA (the viral loop): guest-facing invite and save-the-date mail lands in the
    // exact target demographic, so every one is a free impression. This block invites a guest who
    // is also engaged to spin up their own free AltarWed wedding site. It renders directly ABOVE
    // the compliance footer (unsubscribe link + postal address), never in place of it, and stays
    // visually secondary to the couple's own content. Styled with inline CSS because email clients
    // strip <style> blocks. The utm_source stays rsvp_email so signups keep flowing into the same
    // MetricsJpaAdapter channel bucket; utm_campaign distinguishes which template drove the signup.
    private String growthCtaUrl(String utmCampaign) {
        return publicBaseUrl + "?utm_source=rsvp_email&utm_medium=email&utm_campaign="
                + utmCampaign + "&utm_content=cta";
    }

    private static String growthCtaHtml(String ctaUrl) {
        return """
                <div style="margin-top:28px;padding:20px 24px;background:#f7f0e6;border-radius:6px;text-align:center;font-family:sans-serif;">
                  <p style="margin:0 0 12px;color:#6b5344;font-size:14px;line-height:1.5;">Getting married too?<br>Create your free Christian wedding website.</p>
                  <a href="%s" style="display:inline-block;padding:10px 24px;background:#4a1942;color:#ffffff;text-decoration:none;border-radius:6px;font-size:13px;">Create your free wedding website</a>
                </div>
                """.formatted(ctaUrl);
    }

    private static String growthCtaText(String ctaUrl) {
        return "\n\nGetting married too? Create your free Christian wedding website:\n" + ctaUrl;
    }

    @Override
    public void sendRsvpInviteEmail(String toEmail, String guestName, String coupleNames,
                                    String weddingDate, String rsvpToken, UUID guestId, UUID coupleId,
                                    String coupleReplyToEmail) {
        if (!isValidEmailAddress(toEmail)) {
            log.warn("rsvp invite skipped, invalid recipient address, type=rsvp-invite, to={}",
                    LogSanitizer.maskEmail(toEmail));
            return;
        }
        Map<String, Object> body = buildRsvpInviteBody(toEmail, guestName, coupleNames,
                weddingDate, rsvpToken, guestId, coupleId, coupleReplyToEmail);
        postEmail("rsvp-invite", toEmail, body);
    }

    // Package-private so the email-template tests can assert the rendered markup (growth CTA,
    // UTM tag, and intact compliance footer) without making a live Resend call.
    Map<String, Object> buildRsvpInviteBody(String toEmail, String guestName, String coupleNames,
                                            String weddingDate, String rsvpToken, UUID guestId, UUID coupleId,
                                            String coupleReplyToEmail) {
        String rsvpUrl = appBaseUrl.replace("app.", "www.") + "/rsvp/" + rsvpToken;

        String viralCtaUrl = growthCtaUrl("viral_invite");

        String html = """
                <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
                  <h2 style="color: #4a1942; font-family: Georgia, serif;">You're invited!</h2>
                  <p>Dear %s,</p>
                  <p><strong>%s</strong> have joyfully invited you to celebrate their wedding on <strong>%s</strong>.</p>
                  <p>Please let them know if you'll be attending by clicking the button below.</p>
                  <a href="%s"
                     style="display:inline-block;padding:12px 28px;background:#4a1942;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0;font-size:16px;">
                    RSVP Now
                  </a>
                  <p style="color:#888;font-size:13px;">
                    If you have any questions, reply to this email.<br>
                    This RSVP link expires in 30 days.
                  </p>
                </div>
                """.formatted(guestName, coupleNames, weddingDate, rsvpUrl);

        String text = """
                You're invited!

                Dear %s,

                %s have joyfully invited you to celebrate their wedding on %s.

                Please RSVP by visiting this link:
                %s

                This link expires in 30 days.
                If you have any questions, reply to this email.
                """.formatted(guestName, coupleNames, weddingDate, rsvpUrl);

        // The invite carries the AltarWed growth CTA (the viral loop), so we treat it as
        // marketing for compliance: a working unsubscribe footer + RFC 8058 one-click
        // header + postal address, scoped to this couple. A guest who opts out here stops
        // only this couple's mail and resubscribes by RSVPing later. Ordering matters: the
        // growth CTA sits BELOW the couple's content and ABOVE the compliance footer.
        String displayUnsubUrl = unsubscribeDisplayUrl(toEmail, coupleId);
        String oneClickUnsubUrl = unsubscribeOneClickUrl(toEmail, coupleId);

        Map<String, Object> body = new HashMap<>();
        body.put("from", coupleNames + " <" + invitesFromEmail + ">");
        body.put("to", List.of(EmailAddresses.normalize(toEmail)));
        addReplyTo(body, coupleReplyToEmail);
        body.put("subject", "You're invited to " + coupleNames + "'s wedding!");
        body.put("html", html + growthCtaHtml(viralCtaUrl) + unsubscribeFooterHtml(displayUnsubUrl));
        body.put("text", text + growthCtaText(viralCtaUrl) + unsubscribeFooterText(displayUnsubUrl));
        body.put("headers", Map.of(
                "List-Unsubscribe", "<" + oneClickUnsubUrl + ">",
                "List-Unsubscribe-Post", "List-Unsubscribe=One-Click"
        ));
        body.put("tags", guestTags(guestId, coupleId, "rsvp-invite"));
        return body;
    }

    @Override
    public void sendSaveTheDateEmails(List<EmailRecipient> recipients, UUID coupleId, String coupleNames,
                                      String weddingDate, String weddingUrl, String stdImageUrl,
                                      String coupleReplyToEmail) {
        // Drop malformed and suppressed recipients up front. Resend's /emails/batch is
        // all-or-nothing: a single invalid address (a double-@ typo, a stray space)
        // rejects the entire 100-message batch with 422 and forces a slow per-recipient
        // fallback. Filtering here keeps every batch clean so the good mail goes through,
        // and honours opt-outs exactly as the single-send path (postMarketingEmail) does.
        long invalid = recipients.stream()
                .filter(r -> r.email() != null && !r.email().isBlank())
                .filter(r -> !isValidEmailAddress(r.email()))
                .count();
        if (invalid > 0) {
            log.warn("save-the-date recipients skipped, reason=invalid address, type=save-the-date, skipped={}", invalid);
        }
        List<Map<String, Object>> messages = recipients.stream()
                .filter(r -> isValidEmailAddress(r.email()))
                .filter(r -> !suppressionPort.isSuppressed(emailHash(r.email())))
                .map(r -> buildSaveTheDateBody(r.email(), r.name(), r.guestId(), coupleId,
                        coupleNames, weddingDate, weddingUrl, stdImageUrl, coupleReplyToEmail))
                .toList();
        postBatch("save-the-date", messages);
    }

    // Package-private so the email-template tests can assert the rendered markup (growth CTA,
    // UTM tag, and intact compliance footer) without making a live Resend call.
    Map<String, Object> buildSaveTheDateBody(String toEmail, String guestName, UUID guestId, UUID coupleId,
                                             String coupleNames, String weddingDate, String weddingUrl,
                                             String stdImageUrl, String coupleReplyToEmail) {
        String imageBlock = (stdImageUrl != null && !stdImageUrl.isBlank())
                ? "<img src=\"" + stdImageUrl + "\" alt=\"Save the Date\" style=\"display:block;width:100%;max-width:540px;margin:0 auto 32px;border-radius:6px;\" />"
                : "";
        String html = """
                <div style="font-family: Georgia, serif; max-width: 540px; margin: 0 auto; background: #fdfaf6; padding: 40px; border-radius: 8px;">
                  %s
                  <p style="text-align:center; color:#a08060; font-size:12px; letter-spacing:0.2em; text-transform:uppercase; margin-bottom:8px;">Save the Date</p>
                  <h1 style="text-align:center; color:#3b2f2f; font-size:36px; margin:0 0 8px;">%s</h1>
                  <p style="text-align:center; color:#3b2f2f; font-size:18px; margin:0 0 32px;">are getting married on <strong>%s</strong></p>
                  <div style="border-top:1px solid #e8dcc8; border-bottom:1px solid #e8dcc8; padding:20px 0; margin-bottom:32px; text-align:center;">
                    <p style="color:#a08060; font-size:13px; margin:0 0 4px;">Dear %s,</p>
                    <p style="color:#3b2f2f; margin:0;">You are joyfully invited to celebrate their marriage. Formal invitation to follow.</p>
                  </div>
                  <div style="text-align:center;">
                    <a href="%s"
                       style="display:inline-block;padding:14px 32px;background:#3b2f2f;color:#d4af6a;text-decoration:none;border-radius:4px;font-size:14px;letter-spacing:0.1em;text-transform:uppercase;">
                      Visit Our Wedding Website
                    </a>
                  </div>
                  <p style="text-align:center; color:#a08060; font-size:11px; margin-top:32px;">
                    "And over all these virtues put on love, which binds them all together in perfect unity." (Colossians 3:14)
                  </p>
                </div>
                """.formatted(imageBlock,
                coupleNames.replace(" & ", "</h1><p style=\"text-align:center; color:#d4af6a; font-size:22px; margin:0 0 8px;\">&amp;</p><h1 style=\"text-align:center; color:#3b2f2f; font-size:36px; margin:0 0 24px;\">"),
                weddingDate, guestName, weddingUrl);

        String displayUnsubUrl = unsubscribeDisplayUrl(toEmail, coupleId);
        String oneClickUnsubUrl = unsubscribeOneClickUrl(toEmail, coupleId);
        // Distinct utm_campaign (std_email vs the invite's viral_invite) so we can tell which
        // template drove a signup; the shared utm_source keeps both in the same channel bucket.
        String stdCtaUrl = growthCtaUrl("std_email");
        String text = """
                Save the Date

                %s are getting married on %s!

                Dear %s, you are joyfully invited to celebrate their marriage. Formal invitation to follow.

                Visit their wedding website: %s

                "And over all these virtues put on love, which binds them all together in perfect unity." (Colossians 3:14)
                """.formatted(coupleNames, weddingDate, guestName, weddingUrl)
                + growthCtaText(stdCtaUrl)
                + unsubscribeFooterText(displayUnsubUrl);

        Map<String, Object> body = new HashMap<>();
        body.put("from", coupleNames + " <" + invitesFromEmail + ">");
        body.put("to", List.of(EmailAddresses.normalize(toEmail)));
        addReplyTo(body, coupleReplyToEmail);
        body.put("subject", "Save the Date: " + coupleNames + " are getting married!");
        // Growth CTA sits below the couple's content and above the compliance footer.
        body.put("html", html + growthCtaHtml(stdCtaUrl) + unsubscribeFooterHtml(displayUnsubUrl));
        body.put("text", text);
        body.put("headers", Map.of(
                "List-Unsubscribe", "<" + oneClickUnsubUrl + ">",
                "List-Unsubscribe-Post", "List-Unsubscribe=One-Click"
        ));
        body.put("tags", guestTags(guestId, coupleId, "save-the-date"));
        return body;
    }

    @Override
    public void sendRsvpNotificationToCouple(String coupleEmail, String coupleNames,
                                              String guestName, String rsvpStatus,
                                              String noteForCouple,
                                              String dashboardUrl,
                                              String guestReplyToEmail) {
        boolean attending = "ATTENDING".equalsIgnoreCase(rsvpStatus);
        String emoji      = attending ? "🎉" : "😔";
        String statusWord = attending ? "Attending" : "Declining";
        String statusColor = attending ? "#16a34a" : "#dc2626";

        String noteRow = (noteForCouple != null && !noteForCouple.isBlank())
                ? """
                  <tr><td colspan="2" style="padding-top:12px;">
                    <div style="background:#fdf8f0;border-left:3px solid #d4af6a;padding:10px 14px;border-radius:4px;color:#3b2f2f;font-style:italic;">
                      "%s"
                    </div>
                  </td></tr>
                  """.formatted(noteForCouple)
                : "";

        String html = """
                <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;background:#fdfaf6;padding:40px;border-radius:8px;">
                  <p style="text-align:center;color:#a08060;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:16px;">AltarWed, RSVP Update</p>
                  <h2 style="text-align:center;color:#3b2f2f;margin:0 0 8px;">%s %s</h2>
                  <p style="text-align:center;color:#6b5344;margin:0 0 32px;font-size:16px;">
                    <strong>%s</strong> has responded to your wedding invitation.
                  </p>
                  <table style="width:100%%;border-collapse:collapse;margin-bottom:24px;font-size:15px;">
                    <tr>
                      <td style="color:#6b5344;padding:4px 0;">Guest</td>
                      <td style="padding:4px 0;font-weight:600;color:#3b2f2f;">%s</td>
                    </tr>
                    <tr>
                      <td style="color:#6b5344;padding:4px 0;">Status</td>
                      <td style="padding:4px 0;font-weight:700;color:%s;">%s</td>
                    </tr>
                    %s
                  </table>
                  <div style="text-align:center;">
                    <a href="%s"
                       style="display:inline-block;padding:12px 28px;background:#3b2f2f;color:#d4af6a;text-decoration:none;border-radius:4px;font-size:14px;letter-spacing:0.05em;">
                      View Guest List
                    </a>
                  </div>
                  <p style="text-align:center;color:#a08060;font-size:11px;margin-top:32px;">
                    "And over all these virtues put on love, which binds them all together in perfect unity." (Colossians 3:14)
                  </p>
                </div>
                """.formatted(emoji, statusWord, guestName, guestName, statusColor, statusWord, noteRow, dashboardUrl);

        String text = """
                %s %s responded to your wedding invitation.

                Guest: %s
                Status: %s
                %s
                View your guest list: %s
                """.formatted(
                emoji, guestName, guestName, statusWord,
                noteForCouple != null && !noteForCouple.isBlank() ? "Note for you: \"" + noteForCouple + "\"\n" : "",
                dashboardUrl
        );

        String subject = attending
                ? emoji + " " + guestName + " is attending your wedding!"
                : emoji + " " + guestName + " can't make it to your wedding";

        Map<String, Object> body = new HashMap<>();
        body.put("from", "AltarWed <" + fromEmail + ">");
        body.put("to", List.of(coupleEmail));
        addReplyTo(body, guestReplyToEmail);
        body.put("subject", subject);
        body.put("html", html);
        body.put("text", text);

        postEmail("rsvp-notification", coupleEmail, body);
    }

    @Override
    public void sendVendorInquiryEmail(String vendorEmail, String vendorBusinessName,
                                        String coupleName, String coupleEmail,
                                        String weddingDate, String message,
                                        String vendorProfileUrl) {
        // HTML message body is sanitized by escaping the couple-supplied text fields.
        // We do not interpolate untrusted input into href/src attributes.
        String safeCoupleName = escapeHtml(coupleName);
        String safeMessage    = escapeHtml(message).replace("\n", "<br>");
        String safeWeddingDateRow = (weddingDate != null && !weddingDate.isBlank())
                ? """
                  <tr>
                    <td style="color:#6b5344;padding:4px 0;width:120px;">Wedding date</td>
                    <td style="padding:4px 0;color:#3b2f2f;font-weight:600;">%s</td>
                  </tr>
                  """.formatted(escapeHtml(weddingDate))
                : "";

        String html = """
                <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;background:#fdfaf6;padding:40px;border-radius:8px;">
                  <p style="text-align:center;color:#a08060;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">AltarWed Vendor Inquiry</p>
                  <h2 style="text-align:center;color:#3b2f2f;margin:0 0 8px;">New inquiry for %s</h2>
                  <p style="text-align:center;color:#6b5344;margin:0 0 32px;font-size:15px;">
                    A couple has reached out about your services through AltarWed.
                  </p>
                  <table style="width:100%%;border-collapse:collapse;margin-bottom:20px;font-size:15px;">
                    <tr>
                      <td style="color:#6b5344;padding:4px 0;width:120px;">From</td>
                      <td style="padding:4px 0;color:#3b2f2f;font-weight:600;">%s</td>
                    </tr>
                    <tr>
                      <td style="color:#6b5344;padding:4px 0;">Reply to</td>
                      <td style="padding:4px 0;color:#3b2f2f;"><a href="mailto:%s" style="color:#3b2f2f;text-decoration:underline;">%s</a></td>
                    </tr>
                    %s
                  </table>
                  <div style="background:#fff;border-left:3px solid #d4af6a;padding:14px 18px;border-radius:4px;color:#3b2f2f;line-height:1.6;margin-bottom:28px;">
                    %s
                  </div>
                  <p style="color:#6b5344;font-size:13px;margin:0 0 24px;">
                    To respond, just hit reply on this email. Your reply will go straight to the couple's inbox.
                  </p>
                  <div style="text-align:center;">
                    <a href="%s"
                       style="display:inline-block;padding:12px 28px;background:#3b2f2f;color:#d4af6a;text-decoration:none;border-radius:4px;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">
                      View your listing
                    </a>
                  </div>
                  <p style="text-align:center;color:#a08060;font-size:11px;margin-top:32px;">
                    Sent via AltarWed, the faith-first wedding marketplace.
                  </p>
                </div>
                """.formatted(escapeHtml(vendorBusinessName), safeCoupleName, escapeHtml(coupleEmail), escapeHtml(coupleEmail), safeWeddingDateRow, safeMessage, vendorProfileUrl);

        String text = """
                New AltarWed inquiry for %s

                From: %s
                Reply to: %s
                %s

                Message:
                %s

                To respond, reply directly to this email. Your reply will go to the couple's inbox.

                View your listing: %s
                """.formatted(
                vendorBusinessName,
                coupleName,
                coupleEmail,
                weddingDate != null && !weddingDate.isBlank() ? "Wedding date: " + weddingDate : "",
                message,
                vendorProfileUrl
        );

        // Reply-To routes vendor replies back to the couple. From-address must
        // remain on our verified Resend domain (altarwed.com); we cannot spoof
        // the couple's email in From without breaking SPF/DKIM.
        Map<String, Object> body = Map.of(
                "from", "AltarWed Inquiries <" + fromEmail + ">",
                "to", List.of(vendorEmail),
                "reply_to", coupleEmail,
                "subject", "New inquiry from " + coupleName + " for " + vendorBusinessName,
                "html", html,
                "text", text
        );

        postEmail("vendor-inquiry", vendorEmail, body);
    }

    @Override
    public void sendVendorInquiryConfirmation(String coupleEmail, String coupleName,
                                               String vendorBusinessName, String vendorProfileUrl) {
        String html = """
                <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;background:#fdfaf6;padding:40px;border-radius:8px;">
                  <p style="text-align:center;color:#a08060;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">AltarWed</p>
                  <h2 style="text-align:center;color:#3b2f2f;margin:0 0 16px;">Inquiry sent</h2>
                  <p style="color:#3b2f2f;font-size:15px;line-height:1.6;">
                    Hi %s,
                  </p>
                  <p style="color:#3b2f2f;font-size:15px;line-height:1.6;">
                    We just delivered your inquiry to <strong>%s</strong>. They will reply to you directly at the email you provided. Typical response time is 1 to 3 business days; if you have not heard back in a week, feel free to send a follow-up.
                  </p>
                  <p style="color:#3b2f2f;font-size:15px;line-height:1.6;">
                    In the meantime, you can continue browsing other vendors that fit your wedding vision.
                  </p>
                  <div style="text-align:center;margin:28px 0 16px;">
                    <a href="%s"
                       style="display:inline-block;padding:12px 28px;background:#3b2f2f;color:#d4af6a;text-decoration:none;border-radius:4px;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">
                      View vendor profile
                    </a>
                  </div>
                  <p style="text-align:center;color:#a08060;font-size:11px;margin-top:24px;">
                    "Plans fail for lack of counsel, but with many advisers they succeed." Proverbs 15:22
                  </p>
                </div>
                """.formatted(escapeHtml(coupleName), escapeHtml(vendorBusinessName), vendorProfileUrl);

        String text = """
                Inquiry sent

                Hi %s,

                We just delivered your inquiry to %s. They will reply to you directly at the email you provided. Typical response time is 1 to 3 business days.

                View vendor profile: %s
                """.formatted(coupleName, vendorBusinessName, vendorProfileUrl);

        Map<String, Object> body = Map.of(
                "from", "AltarWed <" + fromEmail + ">",
                "to", List.of(coupleEmail),
                "subject", "Your inquiry to " + vendorBusinessName + " has been sent",
                "html", html,
                "text", text
        );

        postEmail("vendor-inquiry-confirmation", coupleEmail, body);
    }

    @Override
    public void sendVendorRegistrationAlert(String businessName, String category,
                                             String city, String state, String vendorEmail,
                                             String vendorId, String adminListingUrl,
                                             boolean autoVerified) {
        String verifiedNote = autoVerified
                ? "This vendor is a <strong>Founding Vendor</strong> and has been auto-verified. Their listing is live in the directory. If it looks like spam or a non-faith-based business, unverify it:"
                : "This vendor is <strong>NOT yet verified</strong> and is not visible in the directory. To publish their listing:";
        String verifiedNoteText = autoVerified
                ? "This vendor is a Founding Vendor and has been auto-verified. Listing is live."
                : "This vendor is NOT yet verified. To make their listing live:";

        String html = """
                <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;background:#fdfaf6;padding:32px;border-radius:8px;border:1px solid #e8dcc8;">
                  <p style="text-align:center;color:#a08060;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">AltarWed Admin</p>
                  <h2 style="text-align:center;color:#3b2f2f;font-size:22px;margin:0 0 24px;">New vendor registered</h2>
                  <table style="width:100%%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
                    <tr><td style="color:#6b5344;padding:5px 0;width:120px;">Business</td><td style="color:#3b2f2f;font-weight:600;">%s</td></tr>
                    <tr><td style="color:#6b5344;padding:5px 0;">Category</td><td style="color:#3b2f2f;">%s</td></tr>
                    <tr><td style="color:#6b5344;padding:5px 0;">Location</td><td style="color:#3b2f2f;">%s, %s</td></tr>
                    <tr><td style="color:#6b5344;padding:5px 0;">Email</td><td style="color:#3b2f2f;">%s</td></tr>
                    <tr><td style="color:#6b5344;padding:5px 0;">Vendor ID</td><td style="color:#a08060;font-size:11px;">%s</td></tr>
                  </table>
                  <p style="color:#6b5344;font-size:13px;margin-bottom:20px;">%s</p>
                  <div style="text-align:center;">
                    <a href="%s"
                       style="display:inline-block;padding:10px 24px;background:#3b2f2f;color:#d4af6a;text-decoration:none;border-radius:4px;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">
                      View listing
                    </a>
                  </div>
                </div>
                """.formatted(
                escapeHtml(businessName), escapeHtml(category),
                escapeHtml(city), escapeHtml(state),
                escapeHtml(vendorEmail), escapeHtml(vendorId),
                verifiedNote,
                adminListingUrl
        );

        String verifyAction = autoVerified
                ? "To unverify: PATCH " + apiBaseUrl + "/api/v1/admin/vendors/" + vendorId + "/unverify"
                : "To verify: PATCH " + apiBaseUrl + "/api/v1/admin/vendors/" + vendorId + "/verify";
        String text = """
                New vendor registered on AltarWed

                Business: %s
                Category: %s
                Location: %s, %s
                Email: %s
                Vendor ID: %s

                %s
                %s (requires admin auth)

                Public listing: %s
                """.formatted(businessName, category, city, state, vendorEmail, vendorId,
                verifiedNoteText, verifyAction, adminListingUrl);

        Map<String, Object> body = Map.of(
                "from", "AltarWed <" + fromEmail + ">",
                "to", List.of(adminAlertEmail),
                "subject", "New vendor: " + businessName + " (" + category + ", " + city + ")",
                "html", html,
                "text", text
        );

        postEmail("vendor-registration-alert", adminAlertEmail, body);
    }

    @Override
    public void sendCoupleWebsiteCreatedAlert(String coupleEmail, String partnerOneName,
                                               String partnerTwoName, String slug, String siteUrl) {
        String html = """
                <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;background:#fdfaf6;padding:32px;border-radius:8px;border:1px solid #e8dcc8;">
                  <p style="text-align:center;color:#a08060;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">AltarWed Admin</p>
                  <h2 style="text-align:center;color:#3b2f2f;font-size:22px;margin:0 0 24px;">New wedding website created</h2>
                  <table style="width:100%%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
                    <tr><td style="color:#6b5344;padding:5px 0;width:120px;">Couple</td><td style="color:#3b2f2f;font-weight:600;">%s &amp; %s</td></tr>
                    <tr><td style="color:#6b5344;padding:5px 0;">Email</td><td style="color:#3b2f2f;">%s</td></tr>
                    <tr><td style="color:#6b5344;padding:5px 0;">URL</td><td style="color:#3b2f2f;">%s</td></tr>
                  </table>
                  <div style="text-align:center;">
                    <a href="%s"
                       style="display:inline-block;padding:10px 24px;background:#3b2f2f;color:#d4af6a;text-decoration:none;border-radius:4px;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">
                      View site
                    </a>
                  </div>
                </div>
                """.formatted(
                escapeHtml(partnerOneName), escapeHtml(partnerTwoName),
                escapeHtml(coupleEmail), escapeHtml(slug),
                siteUrl
        );

        String text = """
                New wedding website created on AltarWed

                Couple: %s & %s
                Email: %s
                Slug: %s
                Site: %s
                """.formatted(partnerOneName, partnerTwoName, coupleEmail, slug, siteUrl);

        Map<String, Object> body = Map.of(
                "from", "AltarWed <" + fromEmail + ">",
                "to", List.of(adminAlertEmail),
                "subject", "New wedding site: " + partnerOneName + " & " + partnerTwoName,
                "html", html,
                "text", text
        );

        postEmail("couple-website-created-alert", adminAlertEmail, body);
    }

    @Override
    public void sendVendorWelcomeEmail(String toEmail, String businessName,
                                       String listingUrl, String dashboardUrl,
                                       boolean isFoundingVendor) {
        String statusLine = isFoundingVendor
                ? "Your listing is <strong>live now</strong> as a founding vendor of AltarWed."
                : "Your listing is under review. We will email you once it is approved and visible to couples.";
        String statusText = isFoundingVendor
                ? "Your listing is live now as a founding vendor of AltarWed."
                : "Your listing is under review. We will email you once it is approved and visible to couples.";
        String subjectSuffix = isFoundingVendor ? " - your listing is live!" : " - welcome aboard";

        String html = """
                <div style="font-family:Georgia,serif;max-width:540px;margin:0 auto;background:#fdfaf6;padding:40px;border-radius:8px;">
                  <p style="text-align:center;color:#a08060;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">AltarWed Vendors</p>
                  <h1 style="text-align:center;color:#3b2f2f;font-size:26px;margin:0 0 16px;">Welcome, %s</h1>
                  <p style="color:#3b2f2f;font-size:15px;line-height:1.7;">%s</p>
                  <p style="color:#3b2f2f;font-size:15px;line-height:1.7;">
                    AltarWed is a faith-first wedding marketplace connecting Christian couples with vendors who share their values. We are glad you are here.
                  </p>
                  <p style="color:#3b2f2f;font-size:15px;line-height:1.7;">
                    Complete your profile to make the best first impression: add a bio, description, price tier, and logo. Couples who find your listing will be able to send you inquiries directly.
                  </p>
                  <div style="text-align:center;margin:28px 0 12px;">
                    <a href="%s"
                       style="display:inline-block;padding:12px 28px;background:#3b2f2f;color:#d4af6a;text-decoration:none;border-radius:4px;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">
                      Go to your dashboard
                    </a>
                  </div>
                  %s
                  <p style="text-align:center;color:#a08060;font-size:11px;margin-top:32px;">
                    "Whatever you do, work at it with all your heart, as working for the Lord." (Col 3:23)
                  </p>
                </div>
                """.formatted(
                escapeHtml(businessName),
                statusLine,
                dashboardUrl,
                isFoundingVendor
                        ? "<div style=\"text-align:center;margin-bottom:24px;\"><a href=\"" + listingUrl
                          + "\" style=\"color:#3b2f2f;font-size:13px;\">View your public listing</a></div>"
                        : ""
        );

        String text = """
                Welcome to AltarWed, %s

                %s

                AltarWed is a faith-first wedding marketplace connecting Christian couples with vendors who share their values. We are glad you are here.

                Complete your profile to make the best first impression:
                %s

                Dashboard: %s
                %s
                "Whatever you do, work at it with all your heart, as working for the Lord." (Col 3:23)
                """.formatted(
                businessName, statusText,
                "Add a bio, description, price tier, and logo. Couples who find your listing will be able to send inquiries directly.",
                dashboardUrl,
                isFoundingVendor ? "Your listing: " + listingUrl + "\n" : ""
        );

        Map<String, Object> body = Map.of(
                "from", "AltarWed <" + fromEmail + ">",
                "to", List.of(toEmail),
                "subject", "Welcome to AltarWed" + subjectSuffix,
                "html", html,
                "text", text
        );

        postEmail("vendor-welcome", toEmail, body);
    }

    @Override
    public void sendVendorVerifiedEmail(String toEmail, String businessName,
                                        String listingUrl, String dashboardUrl) {
        String html = """
                <div style="font-family:Georgia,serif;max-width:540px;margin:0 auto;background:#fdfaf6;padding:40px;border-radius:8px;">
                  <p style="text-align:center;color:#a08060;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">AltarWed Vendors</p>
                  <h1 style="text-align:center;color:#3b2f2f;font-size:26px;margin:0 0 8px;">Your listing is live!</h1>
                  <p style="text-align:center;color:#6b5344;font-size:16px;margin:0 0 28px;">%s is now visible to Christian couples on AltarWed.</p>
                  <p style="color:#3b2f2f;font-size:15px;line-height:1.7;">
                    Couples searching for faith-aligned vendors in your area can now find and contact you. Log in to complete your profile and make the strongest first impression.
                  </p>
                  <div style="text-align:center;margin:28px 0 12px;">
                    <a href="%s"
                       style="display:inline-block;padding:12px 28px;background:#3b2f2f;color:#d4af6a;text-decoration:none;border-radius:4px;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">
                      View your listing
                    </a>
                  </div>
                  <div style="text-align:center;margin-bottom:24px;">
                    <a href="%s" style="color:#3b2f2f;font-size:13px;">Go to your dashboard</a>
                  </div>
                  <p style="text-align:center;color:#a08060;font-size:11px;margin-top:32px;">
                    "Whatever you do, work at it with all your heart, as working for the Lord." (Col 3:23)
                  </p>
                </div>
                """.formatted(escapeHtml(businessName), listingUrl, dashboardUrl);

        String text = """
                Your AltarWed listing is live!

                %s is now visible to Christian couples on AltarWed.

                Couples searching for faith-aligned vendors in your area can now find and contact you. Log in to complete your profile and make the strongest first impression.

                View your listing: %s
                Dashboard: %s

                "Whatever you do, work at it with all your heart, as working for the Lord." (Col 3:23)
                """.formatted(businessName, listingUrl, dashboardUrl);

        Map<String, Object> body = Map.of(
                "from", "AltarWed <" + fromEmail + ">",
                "to", List.of(toEmail),
                "subject", "Your AltarWed listing is live - " + businessName,
                "html", html,
                "text", text
        );

        postEmail("vendor-verified", toEmail, body);
    }

    // Routes guest replies to the couple's own inbox. Skipped when the couple address is
    // missing or invalid (the reply then falls back to the From address) rather than
    // sending Resend a malformed reply_to that could 422 the whole message. We never put
    // the couple's address in From: that must stay on the verified altarwed.com domain
    // for SPF/DKIM, so Reply-To is the correct, deliverable mechanism.
    private static void addReplyTo(Map<String, Object> body, String coupleReplyToEmail) {
        if (coupleReplyToEmail != null && isValidEmailAddress(coupleReplyToEmail)) {
            body.put("reply_to", EmailAddresses.normalize(coupleReplyToEmail));
        }
    }

    // Tags travel with the message and are echoed back in Resend's delivery webhook,
    // letting EmailDeliveryService map a delivery/bounce event to the right guest.
    // Resend tag names/values accept only [A-Za-z0-9_-]; UUIDs and our email-type
    // slugs ("save-the-date", "rsvp-invite") already satisfy that.
    private static List<Map<String, String>> guestTags(UUID guestId, UUID coupleId, String emailType) {
        List<Map<String, String>> tags = new ArrayList<>();
        if (guestId != null) tags.add(Map.of("name", "guest_id", "value", guestId.toString()));
        if (coupleId != null) tags.add(Map.of("name", "couple_id", "value", coupleId.toString()));
        tags.add(Map.of("name", "email_type", "value", emailType));
        return tags;
    }

    // Keeps malformed addresses out of a batch (where one bad address 422s all 100).
    // Shares the exact rule the guest service uses to flag bad addresses to the couple.
    private static boolean isValidEmailAddress(String email) {
        return EmailAddresses.isValid(email);
    }

    // A 429 from Resend means one of two very different things: a per-second rate-limit
    // (transient, worth a short backoff) or daily/monthly quota exhaustion (won't recover
    // for hours, so retrying just burns attempts and, on the transactional path, throws
    // an uncaught async ERROR per send). The response body's name/message carries "quota"
    // only in the latter case, so we branch on that.
    private static boolean isQuotaExhausted(RestClientResponseException ex) {
        String body = ex.getResponseBodyAsString();
        return body != null && body.toLowerCase().contains("quota");
    }

    // Minimal HTML escape for fields we interpolate into email markup. We do
    // NOT interpolate untrusted input into href/src attributes or into <script>
    // contexts; only into text content and innerHTML-equivalent positions.
    private static String escapeHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    @Override
    public void sendPasswordResetEmail(String toEmail, String resetToken) {
        String resetUrl = appBaseUrl + "/reset-password?token=" + resetToken;

        String html = """
                <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                  <h2 style="color: #4a1942;">Reset your AltarWed password</h2>
                  <p>We received a request to reset the password for your AltarWed account.</p>
                  <p>Click the button below to choose a new password. This link expires in <strong>15 minutes</strong>.</p>
                  <a href="%s"
                     style="display:inline-block;padding:12px 24px;background:#4a1942;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0;">
                    Reset Password
                  </a>
                  <p style="color:#666;font-size:13px;">
                    If you did not request this, you can safely ignore this email.<br>
                    Your password will not change until you click the link above.
                  </p>
                </div>
                """.formatted(resetUrl);

        String text = """
                Reset your AltarWed password

                We received a request to reset your password.

                Click this link to choose a new password (expires in 15 minutes):
                %s

                If you did not request this, you can safely ignore this email.
                """.formatted(resetUrl);

        Map<String, Object> body = Map.of(
                "from", "AltarWed <" + fromEmail + ">",
                "to", List.of(toEmail),
                "subject", "Reset your AltarWed password",
                "html", html,
                "text", text
        );

        postEmail("password-reset", toEmail, body);
    }

    @Override
    public void sendWelcomeEmail(String toEmail, String partnerOneName, String partnerTwoName) {
        // app.altarwed.com is the SPA; land them straight on the website builder
        // (the page builder, the sole editor since issue #181), the highest-value
        // first action for a new couple.
        String dashboardUrl = appBaseUrl + "/dashboard/website/editor";
        String coupleNames = escapeHtml(partnerOneName) + " &amp; " + escapeHtml(partnerTwoName);

        String html = """
                <div style="font-family:Georgia,serif;max-width:540px;margin:0 auto;background:#fdfaf6;padding:40px;border-radius:8px;">
                  <p style="text-align:center;color:#a08060;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">Welcome to AltarWed</p>
                  <h1 style="text-align:center;color:#3b2f2f;font-size:30px;margin:0 0 16px;">%s</h1>
                  <p style="color:#3b2f2f;font-size:15px;line-height:1.7;">
                    Congratulations on your engagement. We built AltarWed to help Christian couples plan a wedding that keeps covenant, scripture, and faith at the center, and we are honored to walk this season with you.
                  </p>
                  <p style="color:#3b2f2f;font-size:15px;line-height:1.7;">
                    Your first step is your free wedding website. Add your story, your venue, and your registry, then share the link with family and friends. It takes about ten minutes to look beautiful.
                  </p>
                  <div style="text-align:center;margin:28px 0 16px;">
                    <a href="%s"
                       style="display:inline-block;padding:14px 32px;background:#3b2f2f;color:#d4af6a;text-decoration:none;border-radius:4px;font-size:14px;letter-spacing:0.1em;text-transform:uppercase;">
                      Build Your Website
                    </a>
                  </div>
                  <p style="text-align:center;color:#a08060;font-size:11px;margin-top:32px;">
                    "Therefore what God has joined together, let no one separate." (Mark 10:9)
                  </p>
                </div>
                """.formatted(coupleNames, dashboardUrl);

        // Couple-facing mail: no couple scoping, a legacy global opt-out link.
        String displayUnsubUrl = unsubscribeDisplayUrl(toEmail, null);
        String oneClickUnsubUrl = unsubscribeOneClickUrl(toEmail, null);
        String text = """
                Welcome to AltarWed

                Congratulations on your engagement, %s and %s.

                We built AltarWed to help Christian couples plan a wedding that keeps covenant, scripture, and faith at the center.

                Your first step is your free wedding website. Add your story, your venue, and your registry, then share the link with family and friends:
                %s

                "Therefore what God has joined together, let no one separate." (Mark 10:9)
                """.formatted(partnerOneName, partnerTwoName, dashboardUrl)
                + unsubscribeFooterText(displayUnsubUrl);

        Map<String, Object> body = new HashMap<>();
        body.put("from", "AltarWed <" + fromEmail + ">");
        body.put("to", List.of(toEmail));
        body.put("subject", "Welcome to AltarWed, let's build your wedding website");
        body.put("html", html + unsubscribeFooterHtml(displayUnsubUrl));
        body.put("text", text);
        body.put("headers", Map.of(
                "List-Unsubscribe", "<" + oneClickUnsubUrl + ">",
                "List-Unsubscribe-Post", "List-Unsubscribe=One-Click"
        ));

        postMarketingEmail("welcome", toEmail, body);
    }

    @Override
    public void sendAccountDeletedEmail(String toEmail, String partnerOneName, String partnerTwoName) {
        String signupUrl = appBaseUrl + "/signup";

        String html = """
                <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;background:#fdfaf6;padding:40px;border-radius:8px;">
                  <p style="text-align:center;color:#a08060;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">AltarWed</p>
                  <h2 style="text-align:center;color:#3b2f2f;margin:0 0 16px;">Your account has been deleted</h2>
                  <p style="color:#3b2f2f;font-size:15px;line-height:1.7;">
                    Hi %s and %s,
                  </p>
                  <p style="color:#3b2f2f;font-size:15px;line-height:1.7;">
                    We have permanently deleted your AltarWed account and all of its data, including your wedding website, guest list, and planning details. Nothing was retained, and this cannot be undone.
                  </p>
                  <p style="color:#3b2f2f;font-size:15px;line-height:1.7;">
                    Thank you for letting us be part of your story. If your plans bring you back, you are always welcome to start fresh.
                  </p>
                  <div style="text-align:center;margin:28px 0 16px;">
                    <a href="%s"
                       style="display:inline-block;padding:12px 28px;background:#3b2f2f;color:#d4af6a;text-decoration:none;border-radius:4px;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">
                      Create a new account
                    </a>
                  </div>
                  <p style="text-align:center;color:#a08060;font-size:11px;margin-top:32px;">
                    "May the Lord bless you and keep you." (Numbers 6:24)
                  </p>
                </div>
                """.formatted(escapeHtml(partnerOneName), escapeHtml(partnerTwoName), signupUrl);

        String text = """
                Your AltarWed account has been deleted

                Hi %s and %s,

                We have permanently deleted your AltarWed account and all of its data, including your wedding website, guest list, and planning details. Nothing was retained, and this cannot be undone.

                Thank you for letting us be part of your story. If your plans bring you back, you are always welcome to start fresh:
                %s

                "May the Lord bless you and keep you." (Numbers 6:24)
                """.formatted(partnerOneName, partnerTwoName, signupUrl);

        Map<String, Object> body = Map.of(
                "from", "AltarWed <" + fromEmail + ">",
                "to", List.of(toEmail),
                "subject", "Your AltarWed account has been deleted",
                "html", html,
                "text", text
        );

        postEmail("account-deleted", toEmail, body);
    }

    @Override
    public void sendWeddingPublishedEmail(String toEmail, String partnerOneName,
                                          String partnerTwoName, String weddingUrl) {
        String coupleNames = escapeHtml(partnerOneName) + " &amp; " + escapeHtml(partnerTwoName);

        String html = """
                <div style="font-family:Georgia,serif;max-width:540px;margin:0 auto;background:#fdfaf6;padding:40px;border-radius:8px;">
                  <p style="text-align:center;color:#a08060;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">AltarWed</p>
                  <h1 style="text-align:center;color:#3b2f2f;font-size:28px;margin:0 0 8px;">Your wedding website is live!</h1>
                  <p style="text-align:center;color:#d4af6a;font-size:18px;margin:0 0 28px;">%s</p>
                  <p style="color:#3b2f2f;font-size:15px;line-height:1.7;">
                    Congratulations! Your wedding website is now published and ready to share with your guests. Anyone with the link can view your site, RSVP, and find all the details for your celebration.
                  </p>
                  <div style="text-align:center;margin:28px 0;">
                    <a href="%s"
                       style="display:inline-block;padding:14px 32px;background:#3b2f2f;color:#d4af6a;text-decoration:none;border-radius:4px;font-size:14px;letter-spacing:0.05em;">
                      View Your Wedding Website
                    </a>
                  </div>
                  <p style="color:#3b2f2f;font-size:14px;line-height:1.7;text-align:center;">
                    Share this link with your guests:<br>
                    <a href="%s" style="color:#d4af6a;word-break:break-all;">%s</a>
                  </p>
                  <p style="text-align:center;color:#a08060;font-size:11px;margin-top:32px;">
                    "May the Lord bless you and keep you." (Numbers 6:24)
                  </p>
                </div>
                """.formatted(coupleNames, weddingUrl, weddingUrl, weddingUrl);

        String text = """
                Your wedding website is live!

                Congratulations, %s and %s!

                Your wedding website is now published and ready to share with your guests.

                Share this link with everyone:
                %s

                Anyone with the link can RSVP and find all the details for your celebration.

                "May the Lord bless you and keep you." (Numbers 6:24)
                """.formatted(partnerOneName, partnerTwoName, weddingUrl);

        Map<String, Object> body = Map.of(
                "from", "AltarWed <" + fromEmail + ">",
                "to", List.of(toEmail),
                "subject", "Your wedding website is live! Share the link with your guests",
                "html", html,
                "text", text
        );

        postEmail("wedding-published", toEmail, body);
    }

    // Marketing emails (save-the-date, welcome) check the suppression list first.
    // Transactional emails (password-reset, rsvp, vendor-inquiry, account-deleted)
    // bypass suppression: a user who opted out of marketing still needs to receive
    // their password reset and RSVP confirmations.
    private void postMarketingEmail(String emailType, String toEmail, Map<String, Object> body) {
        String hash = emailHash(toEmail);
        if (suppressionPort.isSuppressed(hash)) {
            log.info("marketing email suppressed, skipping send, type={}", emailType);
            return;
        }
        postEmail(emailType, toEmail, body);
    }

    private void postEmail(String emailType, String toEmail, Map<String, Object> body) {
        String maskedTo = LogSanitizer.maskEmail(toEmail);
        log.debug("sending email via resend, type={}, to={}", emailType, maskedTo);

        for (int attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
            // Spend a token before every attempt (first send and each retry) so we
            // never outrun Resend's rate limit. This runs on emailExecutor or a
            // virtual thread, so parking here costs nothing but pacing; throughput
            // is governed by the bucket, not the pool size.
            try {
                resendRateLimiter.asBlocking().consume(1);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                log.warn("resend send interrupted awaiting rate-limit token, type={}, to={}, attempt={}", emailType, maskedTo, attempt);
                return;
            }
            try {
                ResponseEntity<Map> response = restClient.post()
                        .uri("/emails")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .toEntity(Map.class);
                Object id = response.getBody() == null ? null : response.getBody().get("id");
                log.debug("resend accepted email, type={}, to={}, resendId={}, attempt={}", emailType, maskedTo, id, attempt);
                return;
            } catch (RestClientResponseException ex) {
                boolean rateLimited = ex.getStatusCode().value() == 429;
                // Quota exhaustion is not retryable within this send and must not bubble
                // up as an ERROR (it would fire on every subsequent transactional send for
                // the rest of the period). Log once at WARN and drop this message.
                if (rateLimited && isQuotaExhausted(ex)) {
                    log.warn("resend quota exhausted, dropping send, type={}, to={}", emailType, maskedTo);
                    return;
                }
                if (!rateLimited || attempt == MAX_SEND_ATTEMPTS) {
                    log.warn("resend rejected email, type={}, to={}, status={}, attempts={}", emailType, maskedTo, ex.getStatusCode(), attempt);
                    throw ex;
                }
                long backoffMs = retryAfterMillis(ex, attempt);
                log.warn("resend rate limited, backing off, type={}, attempt={}, backoffMs={}", emailType, attempt, backoffMs);
                if (!sleepQuietly(backoffMs)) {
                    log.warn("resend send interrupted during backoff, type={}, to={}, attempt={}", emailType, maskedTo, attempt);
                    return;
                }
            } catch (RestClientException ex) {
                log.error("resend call failed, type={}, to={}", emailType, maskedTo, ex);
                throw ex;
            }
        }
    }

    // Honour Resend's Retry-After header (seconds) when present; otherwise fall
    // back to exponential backoff (500ms, 1s, 2s) keyed on the attempt number.
    private long retryAfterMillis(RestClientResponseException ex, int attempt) {
        String retryAfter = ex.getResponseHeaders() == null ? null : ex.getResponseHeaders().getFirst("Retry-After");
        if (retryAfter != null) {
            try {
                return Math.max(1L, Long.parseLong(retryAfter.trim())) * 1000L;
            } catch (NumberFormatException ignored) {
                // Header was an HTTP-date or malformed; use computed backoff below.
            }
        }
        return 500L * (1L << (attempt - 1));
    }

    private boolean sleepQuietly(long millis) {
        try {
            Thread.sleep(millis);
            return true;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    // Sends pre-built, per-recipient message bodies through Resend's POST
    // /emails/batch endpoint in chunks of <= 100. Each chunk is one API call paced
    // by the shared rate limiter, so 200 emails cost ~2 tokens instead of 200.
    private void postBatch(String emailType, List<Map<String, Object>> messages) {
        if (messages.isEmpty()) {
            log.info("resend batch empty after suppression filter, nothing to send, type={}", emailType);
            return;
        }
        int total = messages.size();
        for (int start = 0; start < total; start += MAX_BATCH_SIZE) {
            boolean keepGoing = sendChunk(emailType, messages.subList(start, Math.min(start + MAX_BATCH_SIZE, total)));
            if (!keepGoing) {
                // Quota hit mid-send: the remaining chunks would all fail the same way,
                // so stop rather than fire doomed calls.
                log.warn("resend batch aborted, reason=quota exhausted, type={}, sentBefore={}, total={}",
                        emailType, start, total);
                return;
            }
        }
        log.info("resend batch send completed, type={}, recipients={}", emailType, total);
    }

    // Returns true to continue with the next chunk, false to abort the whole batch
    // (quota exhausted). Per-chunk terminal outcomes (validation fallback, 5xx,
    // transport failure) still return true: they affect only this chunk.
    private boolean sendChunk(String emailType, List<Map<String, Object>> chunk) {
        for (int attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
            try {
                resendRateLimiter.asBlocking().consume(1);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                log.warn("resend batch interrupted awaiting rate-limit token, type={}, size={}, attempt={}", emailType, chunk.size(), attempt);
                return true;
            }
            try {
                restClient.post()
                        .uri("/emails/batch")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(chunk)
                        .retrieve()
                        .toBodilessEntity();
                log.info("resend batch accepted, type={}, size={}, attempt={}", emailType, chunk.size(), attempt);
                return true;
            } catch (RestClientResponseException ex) {
                if (ex.getStatusCode().value() == 429) {
                    // Quota exhaustion will not recover within a backoff window and dooms
                    // every remaining chunk, so abort the whole send rather than retry.
                    if (isQuotaExhausted(ex)) {
                        return false;
                    }
                    if (attempt < MAX_SEND_ATTEMPTS) {
                        long backoffMs = retryAfterMillis(ex, attempt);
                        log.warn("resend batch rate limited, backing off, type={}, attempt={}, backoffMs={}", emailType, attempt, backoffMs);
                        if (!sleepQuietly(backoffMs)) {
                            log.warn("resend batch interrupted during backoff, type={}, size={}, attempt={}", emailType, chunk.size(), attempt);
                            return true;
                        }
                        continue;
                    }
                    // Retries exhausted on a genuine rate-limit: fall through to the
                    // per-recipient path below, which paces each send individually.
                }
                // A 4xx (validation error, e.g. one malformed address, or an exhausted
                // 429) means Resend accepted nothing, so re-sending the chunk one-by-one
                // is safe and lets the good addresses through while isolating the bad one.
                if (ex.getStatusCode().is4xxClientError()) {
                    log.warn("resend batch rejected, falling back to individual sends, type={}, status={}, size={}", emailType, ex.getStatusCode(), chunk.size());
                    sendChunkIndividually(emailType, chunk);
                    return true;
                }
                // A 5xx is ambiguous: Resend may have already processed the batch before
                // failing. Re-sending could double-send up to 100 guests, so stop and
                // surface it for a deliberate re-send rather than risk duplicates.
                log.error("resend batch failed with server error, delivery unknown, not retrying, type={}, status={}, size={}", emailType, ex.getStatusCode(), chunk.size());
                return true;
            } catch (RestClientException ex) {
                // Transport failure (e.g. read timeout) with no response body: the batch
                // may already have been delivered. Re-sending would risk duplicating the
                // whole chunk, so we surface it rather than blindly fall back.
                log.error("resend batch transport failure, delivery unknown, not retrying, type={}, size={}", emailType, chunk.size(), ex);
                return true;
            }
        }
        return true;
    }

    // Per-recipient fallback for a rejected batch: each send is isolated and
    // rate-limited via postEmail, so one bad address does not abort the others.
    private void sendChunkIndividually(String emailType, List<Map<String, Object>> chunk) {
        for (Map<String, Object> message : chunk) {
            try {
                postEmail(emailType, firstRecipient(message), message);
            } catch (RestClientException ex) {
                // postEmail already logged this recipient's failure; continue.
            }
        }
    }

    private String firstRecipient(Map<String, Object> message) {
        Object to = message.get("to");
        if (to instanceof List<?> list && !list.isEmpty()) {
            return String.valueOf(list.get(0));
        }
        return String.valueOf(to);
    }
}
