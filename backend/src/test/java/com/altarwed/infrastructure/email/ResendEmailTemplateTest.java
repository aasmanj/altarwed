package com.altarwed.infrastructure.email;

import com.altarwed.domain.port.EmailSuppressionPort;
import org.junit.jupiter.api.Test;

import java.util.Collection;
import java.util.Collections;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the guest-facing email templates (RSVP invite + save-the-date). These emails land in
 * AltarWed's exact target demographic, so each carries a growth CTA (the viral loop) inviting an
 * engaged guest to create their own free wedding website. This test asserts the CTA and its UTM
 * tag are present in both templates, and, as a regression guard, that the CTA never displaces the
 * compliance footer (unsubscribe link, postal address, and the RFC 8058 one-click headers).
 *
 * The template builders are exercised directly (package-private) so no live Resend call is made.
 */
class ResendEmailTemplateTest {

    private static final String POSTAL_ADDRESS = "AltarWed, 123 Chapel Lane, Suite 4, Portland OR 97201";
    private static final String CTA_HEADLINE = "Getting married too?";
    private static final String CTA_LINK_TEXT = "Create your free wedding website";

    private ResendEmailAdapter newAdapter() {
        // No suppression in these template tests; the builders never consult the port anyway.
        EmailSuppressionPort suppression = new EmailSuppressionPort() {
            @Override public boolean isSuppressed(String emailHash) { return false; }
            @Override public void suppress(String emailHash, String source) { }
            @Override public Optional<String> suppressionSource(String emailHash) { return Optional.empty(); }
            @Override public Map<String, String> suppressionSources(Collection<String> emailHashes) { return Collections.emptyMap(); }
            @Override public boolean clearLegacyUserRequest(String emailHash) { return false; }
        };
        return new ResendEmailAdapter(
                "re_test_key",
                "hello@altarwed.com",
                "hello@invites.altarwed.com",
                "https://app.altarwed.com",
                "https://api.altarwed.com",
                "unsubscribe-signing-secret",
                POSTAL_ADDRESS,
                "admin@altarwed.com",
                2,
                suppression
        );
    }

    @Test
    void inviteEmailCarriesGrowthCtaWithUtmAndKeepsComplianceFooter() {
        ResendEmailAdapter adapter = newAdapter();

        Map<String, Object> body = adapter.buildRsvpInviteBody(
                "guest@example.com", "Sam", "Alex & Jordan",
                "October 3, 2026", "tok-123", UUID.randomUUID(), UUID.randomUUID(), null);

        String html = (String) body.get("html");
        String text = (String) body.get("text");

        // Growth CTA present with copy and a styled link in the HTML part.
        assertThat(html).contains(CTA_HEADLINE);
        assertThat(html).contains(CTA_LINK_TEXT);
        assertThat(text).contains(CTA_HEADLINE);

        // Tagged link: shared source, invite-specific campaign.
        assertThat(html).contains("utm_source=rsvp_email");
        assertThat(html).contains("utm_campaign=viral_invite");
        assertThat(text).contains("utm_campaign=viral_invite");

        // The old undersized attribution footer is gone.
        assertThat(html).doesNotContain("Sent with AltarWed");

        // Compliance footer regression guards: unsubscribe link, postal address, one-click headers.
        assertThat(html).contains("Unsubscribe");
        assertThat(html).contains(POSTAL_ADDRESS);
        assertThat(text).contains("To unsubscribe:");
        assertThat(text).contains(POSTAL_ADDRESS);
        assertOneClickHeaders(body);

        // The growth CTA must sit below the couple's content and above the compliance footer.
        assertThat(html.indexOf("RSVP Now")).isLessThan(html.indexOf(CTA_HEADLINE));
        assertThat(html.indexOf(CTA_HEADLINE)).isLessThan(html.indexOf("Unsubscribe"));
    }

    @Test
    void saveTheDateEmailCarriesGrowthCtaWithUtmAndKeepsComplianceFooter() {
        ResendEmailAdapter adapter = newAdapter();

        Map<String, Object> body = adapter.buildSaveTheDateBody(
                "guest@example.com", "Sam", UUID.randomUUID(), UUID.randomUUID(),
                "Alex & Jordan", "October 3, 2026", "https://www.altarwed.com/wedding/alex-jordan",
                null, null);

        String html = (String) body.get("html");
        String text = (String) body.get("text");

        // Growth CTA present with copy and a styled link.
        assertThat(html).contains(CTA_HEADLINE);
        assertThat(html).contains(CTA_LINK_TEXT);
        assertThat(text).contains(CTA_HEADLINE);

        // Tagged link: shared source, save-the-date-specific campaign distinct from the invite.
        assertThat(html).contains("utm_source=rsvp_email");
        assertThat(html).contains("utm_campaign=std_email");
        assertThat(text).contains("utm_campaign=std_email");

        // Compliance footer regression guards.
        assertThat(html).contains("Unsubscribe");
        assertThat(html).contains(POSTAL_ADDRESS);
        assertThat(text).contains("To unsubscribe:");
        assertThat(text).contains(POSTAL_ADDRESS);
        assertOneClickHeaders(body);

        // The growth CTA must sit above the compliance footer.
        assertThat(html.indexOf(CTA_HEADLINE)).isLessThan(html.indexOf("Unsubscribe"));
    }

    @SuppressWarnings("unchecked")
    private void assertOneClickHeaders(Map<String, Object> body) {
        Map<String, String> headers = (Map<String, String>) body.get("headers");
        assertThat(headers).isNotNull();
        assertThat(headers.get("List-Unsubscribe")).contains("/api/v1/unsubscribe");
        assertThat(headers.get("List-Unsubscribe-Post")).isEqualTo("List-Unsubscribe=One-Click");
    }
}
