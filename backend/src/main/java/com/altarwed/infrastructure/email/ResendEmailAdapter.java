package com.altarwed.infrastructure.email;

import com.altarwed.application.service.EmailSuppressionService;
import com.altarwed.domain.port.EmailPort;
import com.altarwed.domain.port.EmailSuppressionPort;
import com.altarwed.infrastructure.observability.LogSanitizer;
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

@Component
public class ResendEmailAdapter implements EmailPort {

    private static final Logger log = LoggerFactory.getLogger(ResendEmailAdapter.class);

    private final RestClient restClient;
    private final String fromEmail;
    private final String appBaseUrl;
    private final String publicBaseUrl;
    private final String apiBaseUrl;
    private final String unsubscribeSecret;
    private final String postalAddress;
    private final String adminAlertEmail;
    private final EmailSuppressionPort suppressionPort;

    public ResendEmailAdapter(
            @Value("${altarwed.resend.api-key}") String apiKey,
            @Value("${altarwed.resend.from-email}") String fromEmail,
            @Value("${altarwed.app.base-url}") String appBaseUrl,
            @Value("${altarwed.api.base-url}") String apiBaseUrl,
            @Value("${altarwed.unsubscribe.secret}") String unsubscribeSecret,
            @Value("${altarwed.postal-address}") String postalAddress,
            @Value("${altarwed.admin.alert-email:hello@altarwed.com}") String adminAlertEmail,
            EmailSuppressionPort suppressionPort
    ) {
        this.fromEmail = fromEmail;
        this.appBaseUrl = appBaseUrl;
        this.publicBaseUrl = appBaseUrl.replace("app.", "www.");
        this.apiBaseUrl = apiBaseUrl;
        this.unsubscribeSecret = unsubscribeSecret;
        this.postalAddress = postalAddress;
        this.adminAlertEmail = adminAlertEmail;
        this.suppressionPort = suppressionPort;
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
    private String unsubscribeDisplayUrl(String toEmail) {
        String hash = emailHash(toEmail);
        return publicBaseUrl + "/unsubscribe?h=" + hash + "&tok=" + hmacToken(hash);
    }

    private String unsubscribeOneClickUrl(String toEmail) {
        String hash = emailHash(toEmail);
        return apiBaseUrl + "/api/v1/unsubscribe?h=" + hash + "&tok=" + hmacToken(hash);
    }

    private static String emailHash(String email) {
        return EmailSuppressionService.emailHash(email);
    }

    private String hmacToken(String emailHash) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(unsubscribeSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(emailHash.getBytes(StandardCharsets.UTF_8)));
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

    @Override
    public void sendRsvpInviteEmail(String toEmail, String guestName, String coupleNames,
                                    String weddingDate, String rsvpToken) {
        String rsvpUrl = appBaseUrl.replace("app.", "www.") + "/rsvp/" + rsvpToken;

        String viralCtaUrl = publicBaseUrl + "?utm_source=rsvp_email&utm_medium=email&utm_campaign=viral_invite&utm_content=footer";

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
                  <div style="margin-top:28px;border-top:1px solid #e8dcc8;padding-top:14px;text-align:center;color:#a08060;font-size:11px;font-family:sans-serif;">
                    Planning your own wedding?
                    <a href="%s" style="color:#d4af6a;text-decoration:none;">Create a free faith-based wedding website at AltarWed</a>
                  </div>
                </div>
                """.formatted(guestName, coupleNames, weddingDate, rsvpUrl, viralCtaUrl);

        String text = """
                You're invited!

                Dear %s,

                %s have joyfully invited you to celebrate their wedding on %s.

                Please RSVP by visiting this link:
                %s

                This link expires in 30 days.
                If you have any questions, reply to this email.

                ---
                Planning your own wedding? Create a free faith-based wedding website at AltarWed:
                %s
                """.formatted(guestName, coupleNames, weddingDate, rsvpUrl, viralCtaUrl);

        Map<String, Object> body = Map.of(
                "from", coupleNames + " <" + fromEmail + ">",
                "to", List.of(toEmail),
                "subject", "You're invited to " + coupleNames + "'s wedding!",
                "html", html,
                "text", text
        );

        postEmail("rsvp-invite", toEmail, body);
    }

    @Override
    public void sendSaveTheDateEmail(String toEmail, String guestName, String coupleNames,
                                     String weddingDate, String weddingUrl) {
        String html = """
                <div style="font-family: Georgia, serif; max-width: 540px; margin: 0 auto; background: #fdfaf6; padding: 40px; border-radius: 8px;">
                  <p style="text-align:center; color:#a08060; font-size:12px; letter-spacing:0.2em; text-transform:uppercase; margin-bottom:8px;">Save the Date</p>
                  <h1 style="text-align:center; color:#3b2f2f; font-size:36px; margin:0 0 8px;">%s</h1>
                  <p style="text-align:center; color:#d4af6a; font-size:22px; margin:0 0 24px;">&amp;</p>
                  <p style="text-align:center; color:#3b2f2f; font-size:18px; margin:0 0 32px;">are getting married on <strong>%s</strong></p>
                  <div style="border-top:1px solid #e8dcc8; border-bottom:1px solid #e8dcc8; padding:20px 0; margin-bottom:32px; text-align:center;">
                    <p style="color:#a08060; font-size:13px; margin:0 0 4px;">Dear %s,</p>
                    <p style="color:#3b2f2f; margin:0;">You are joyfully invited to celebrate their covenant. Formal invitation to follow.</p>
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
                """.formatted(coupleNames.replace(" & ", "</h1><p style=\"text-align:center; color:#d4af6a; font-size:22px; margin:0 0 8px;\">&amp;</p><h1 style=\"text-align:center; color:#3b2f2f; font-size:36px; margin:0 0 24px;\">"),
                weddingDate, guestName, weddingUrl);

        String displayUnsubUrl = unsubscribeDisplayUrl(toEmail);
        String oneClickUnsubUrl = unsubscribeOneClickUrl(toEmail);
        String text = """
                Save the Date

                %s are getting married on %s!

                Dear %s, you are joyfully invited to celebrate their covenant. Formal invitation to follow.

                Visit their wedding website: %s

                "And over all these virtues put on love, which binds them all together in perfect unity." (Colossians 3:14)
                """.formatted(coupleNames, weddingDate, guestName, weddingUrl)
                + unsubscribeFooterText(displayUnsubUrl);

        Map<String, Object> body = new HashMap<>();
        body.put("from", coupleNames + " <" + fromEmail + ">");
        body.put("to", List.of(toEmail));
        body.put("subject", "Save the Date: " + coupleNames + " are getting married!");
        body.put("html", html + unsubscribeFooterHtml(displayUnsubUrl));
        body.put("text", text);
        body.put("headers", Map.of(
                "List-Unsubscribe", "<" + oneClickUnsubUrl + ">",
                "List-Unsubscribe-Post", "List-Unsubscribe=One-Click"
        ));

        postMarketingEmail("save-the-date", toEmail, body);
    }

    @Override
    public void sendRsvpNotificationToCouple(String coupleEmail, String coupleNames,
                                              String guestName, String rsvpStatus,
                                              String noteForCouple,
                                              String dashboardUrl) {
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

        Map<String, Object> body = Map.of(
                "from", "AltarWed <" + fromEmail + ">",
                "to", List.of(coupleEmail),
                "subject", subject,
                "html", html,
                "text", text
        );

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
                                             String vendorId, String adminListingUrl) {
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
                  <p style="color:#6b5344;font-size:13px;margin-bottom:20px;">
                    This vendor is <strong>auto-verified</strong> and visible in the directory. If the listing looks like spam or a non-faith-based business, you can unverify it:
                  </p>
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
                adminListingUrl
        );

        String text = """
                New vendor registered on AltarWed

                Business: %s
                Category: %s
                Location: %s, %s
                Email: %s
                Vendor ID: %s

                This vendor is auto-verified. To unverify:
                PATCH %s (requires admin auth)

                Public listing: %s
                """.formatted(businessName, category, city, state, vendorEmail, vendorId,
                apiBaseUrl + "/api/v1/admin/vendors/" + vendorId + "/unverify",
                adminListingUrl);

        Map<String, Object> body = Map.of(
                "from", "AltarWed <" + fromEmail + ">",
                "to", List.of(adminAlertEmail),
                "subject", "New vendor: " + businessName + " (" + category + ", " + city + ")",
                "html", html,
                "text", text
        );

        postEmail("vendor-registration-alert", adminAlertEmail, body);
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
        // app.altarwed.com is the SPA; land them straight on the website builder,
        // the highest-value first action for a new couple.
        String dashboardUrl = appBaseUrl + "/dashboard/website";
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

        String displayUnsubUrl = unsubscribeDisplayUrl(toEmail);
        String oneClickUnsubUrl = unsubscribeOneClickUrl(toEmail);
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
        try {
            ResponseEntity<Map> response = restClient.post()
                    .uri("/emails")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .toEntity(Map.class);
            Object id = response.getBody() == null ? null : response.getBody().get("id");
            log.debug("resend accepted email, type={}, to={}, resendId={}", emailType, maskedTo, id);
        } catch (RestClientResponseException ex) {
            log.warn("resend rejected email, type={}, to={}, status={}", emailType, maskedTo, ex.getStatusCode());
            throw ex;
        } catch (RestClientException ex) {
            log.error("resend call failed, type={}, to={}", emailType, maskedTo, ex);
            throw ex;
        }
    }
}
