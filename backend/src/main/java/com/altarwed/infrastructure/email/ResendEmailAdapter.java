package com.altarwed.infrastructure.email;

import com.altarwed.domain.port.EmailPort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Component
public class ResendEmailAdapter implements EmailPort {

    private final RestClient restClient;
    private final String fromEmail;
    private final String appBaseUrl;

    public ResendEmailAdapter(
            @Value("${altarwed.resend.api-key}") String apiKey,
            @Value("${altarwed.resend.from-email}") String fromEmail,
            @Value("${altarwed.app.base-url}") String appBaseUrl
    ) {
        this.fromEmail = fromEmail;
        this.appBaseUrl = appBaseUrl;
        this.restClient = RestClient.builder()
                .baseUrl("https://api.resend.com")
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .build();
    }

    @Override
    public void sendRsvpInviteEmail(String toEmail, String guestName, String coupleNames,
                                    String weddingDate, String rsvpToken) {
        String rsvpUrl = appBaseUrl.replace("app.", "www.") + "/rsvp/" + rsvpToken;

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

        Map<String, Object> body = Map.of(
                "from", coupleNames + " <" + fromEmail + ">",
                "to", List.of(toEmail),
                "subject", "You're invited to " + coupleNames + "'s wedding!",
                "html", html,
                "text", text
        );

        restClient.post()
                .uri("/emails")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .toBodilessEntity();
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

        restClient.post()
                .uri("/emails")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .toBodilessEntity();
    }
}
