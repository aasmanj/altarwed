package com.altarwed.infrastructure.email;

import com.altarwed.domain.model.email.CoupleWinbackTouch;
import com.altarwed.domain.port.EmailSuppressionPort;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the couple win-back templates (issue #551). These are lifecycle marketing sent to a
 * couple who has not activated, so the compliance surface is not optional: every touch must carry a
 * working unsubscribe link, the postal address, and the RFC 8058 one-click headers, and every touch
 * must actually differ from the others (three copies of the same nudge is what earns a spam report).
 *
 * The builder is exercised directly (package-private) so no live Resend call is made.
 */
class ResendCoupleWinbackTemplateTest {

    // The forbidden character, written as an escape so this file does not itself contain it.
    private static final String EM_DASH = "\u2014";

    private static final String POSTAL_ADDRESS = "AltarWed, 123 Chapel Lane, Suite 4, Portland OR 97201";

    private ResendEmailAdapter newAdapter() {
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

    @ParameterizedTest
    @EnumSource(CoupleWinbackTouch.class)
    void everyTouchCarriesTheWebsiteCtaAndAnIntactComplianceFooter(CoupleWinbackTouch touch) {
        Map<String, Object> body = newAdapter().buildCoupleWinbackBody(
                "couple@example.com", "Hannah", "Micah", touch);

        String html = (String) body.get("html");
        String text = (String) body.get("text");
        String subject = (String) body.get("subject");

        assertThat(subject).isNotBlank();

        // The one action that moves couples-shipped: land them on the page builder, tagged so the
        // signup funnel can attribute the activation back to this sequence.
        assertThat(html).contains("https://app.altarwed.com/dashboard/website/editor");
        assertThat(html).contains("utm_source=lifecycle_email");
        assertThat(html).contains("utm_campaign=couple-winback-");
        assertThat(text).contains("https://app.altarwed.com/dashboard/website/editor");

        // Both partners are addressed by name.
        assertThat(html).contains("Hannah");
        assertThat(html).contains("Micah");
        assertThat(text).contains("Hannah & Micah");

        // Compliance footer: unsubscribe link, postal address, RFC 8058 one-click headers.
        assertThat(html).contains("Unsubscribe");
        assertThat(html).contains(POSTAL_ADDRESS);
        assertThat(text).contains("To unsubscribe:");
        assertThat(text).contains(POSTAL_ADDRESS);

        @SuppressWarnings("unchecked")
        Map<String, String> headers = (Map<String, String>) body.get("headers");
        assertThat(headers.get("List-Unsubscribe")).startsWith("<https://api.altarwed.com/api/v1/unsubscribe?h=");
        assertThat(headers.get("List-Unsubscribe-Post")).isEqualTo("List-Unsubscribe=One-Click");

        // Couple-facing lifecycle mail is unscoped (no sending couple), so the link must be the
        // legacy global opt-out form the welcome mail uses. A stray "&c=" would mean the couple
        // unsubscribed from someone else's wedding instead of from this sequence.
        assertThat(headers.get("List-Unsubscribe")).doesNotContain("&c=");

        // No em dashes anywhere in the rendered copy (house rule). Written as an escape so this
        // file does not itself contain the character it forbids.
        assertThat(html).doesNotContain(EM_DASH);
        assertThat(text).doesNotContain(EM_DASH);
    }

    @Test
    void theThreeTouchesAreGenuinelyDifferentEmails() {
        ResendEmailAdapter adapter = newAdapter();
        Set<String> subjects = new HashSet<>();
        Set<String> bodies = new HashSet<>();
        for (CoupleWinbackTouch touch : CoupleWinbackTouch.values()) {
            Map<String, Object> body = adapter.buildCoupleWinbackBody(
                    "couple@example.com", "Hannah", "Micah", touch);
            subjects.add((String) body.get("subject"));
            bodies.add((String) body.get("text"));
        }
        assertThat(subjects).hasSize(CoupleWinbackTouch.values().length);
        assertThat(bodies).hasSize(CoupleWinbackTouch.values().length);
    }

    @Test
    void theFinalTouchTellsTheCoupleItIsTheLastOne() {
        Map<String, Object> body = newAdapter().buildCoupleWinbackBody(
                "couple@example.com", "Hannah", "Micah", CoupleWinbackTouch.DAY_21);

        // Saying so plainly is the difference between a sequence that ends and one that feels like
        // it never will. It is also the honest claim: no touch fires after DAY_21.
        assertThat((String) body.get("text")).contains("last note in this series");
    }
}
