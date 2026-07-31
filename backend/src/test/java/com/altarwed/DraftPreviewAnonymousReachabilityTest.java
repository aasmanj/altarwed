package com.altarwed;

import com.altarwed.domain.model.Couple;
import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins the contract issue #537 documents: an UNAUTHENTICATED GET of
 * /api/v1/wedding-websites/preview/{slug} must return 200 for an unpublished,
 * non-deleted site. The public site's ComingSoon page still falls back to this
 * probe during deploy-skew windows (probeUnpublished in frontend-public
 * wedding/[slug]/data.ts), and the block-editor preview iframe depends on it
 * permanently (no JWT crosses the iframe origin boundary, the slug is the
 * capability). If someone hardens this endpoint while working the #413/#414/#415
 * residuals, this test fails instead of ComingSoon dying silently in prod.
 *
 * Also asserts the #537 slim draft-state contract on /slug/{slug}: 200 with
 * isPublished:false and WITHOUT the full draft DTO's fields for the same draft.
 *
 * Runs through the real HTTP stack (RANDOM_PORT, no auth header) so the
 * SecurityFilterChain's permitAll rules are part of what is being tested; a
 * Mockito controller test cannot catch a SecurityConfig change. Lives in the
 * "schema-validation" suite because it needs the real database (CI spins up SQL
 * Server; the default ./gradlew test skips it).
 */
@Tag("schema-validation")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("ci")
class DraftPreviewAnonymousReachabilityTest {

    // Plain JDK HttpClient against local.server.port instead of a Spring test client:
    // SB4 removed TestRestTemplate (module split), and the JDK client cannot drift.
    @Value("${local.server.port}") int port;
    @Autowired CoupleRepository coupleRepository;
    @Autowired WeddingWebsiteRepository websiteRepository;

    private HttpResponse<String> anonymousGet(String path) throws IOException, InterruptedException {
        return HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET().build(),
                HttpResponse.BodyHandlers.ofString());
    }

    @Test
    void anonymousGetOfDraftPreview_returns200_andSlugReturnsSlimDraftBody() throws Exception {
        String slug = "draft-reachability-" + UUID.randomUUID();
        Couple couple = coupleRepository.save(new Couple(
                null, "Partner One", "Partner Two",
                "draft-reachability-" + UUID.randomUUID() + "@test.local", "x",
                null, null, null, false, true,
                LocalDateTime.now(), LocalDateTime.now()));
        websiteRepository.save(new WeddingWebsite(
                null, couple.id(), slug, false,
                "Partner One", "Partner Two", LocalDate.of(2027, 6, 20), null,
                null, null, null, null, null,
                null, null, null, null,
                null, null, null, null, null, null,
                null, null,
                null, null, null,
                null, null, null, null, null, null,
                null, null, null, null,
                null, null, null, null,
                null,
                null, null, null, null, null, null, null, null, null, null,
                null, null,
                false, null, LocalDateTime.now(), LocalDateTime.now()));

        // No Authorization header on either call: this is the anonymous path.
        HttpResponse<String> preview = anonymousGet("/api/v1/wedding-websites/preview/" + slug);
        assertThat(preview.statusCode())
                .as("anonymous /preview of an unpublished draft (ComingSoon fallback + editor iframe)")
                .isEqualTo(200);
        assertThat(preview.body()).contains("\"isPublished\":false");

        HttpResponse<String> slugResponse = anonymousGet("/api/v1/wedding-websites/slug/" + slug);
        assertThat(slugResponse.statusCode())
                .as("#537 slim draft-state contract: draft answers 200, not 404")
                .isEqualTo(200);
        assertThat(slugResponse.body()).contains("\"isPublished\":false");
        // Slim means slim: the draft body must not carry full-DTO fields.
        assertThat(slugResponse.body()).doesNotContain("ourStory");
    }
}
