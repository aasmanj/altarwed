package com.altarwed.infrastructure.lob;

import com.altarwed.domain.port.PrintMailPort.FromAddress;
import com.altarwed.domain.port.PrintMailPort.PostcardRequest;
import com.altarwed.domain.port.PrintMailPort.ToAddress;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure unit tests for the parts of the Lob adapter that have burned us: the rendered HTML
 * dimensions (Lob 422s when the artwork is not the bleed size) and the error extraction that
 * turns Lob's opaque status code into the message a couple can act on. No Spring context, no
 * network: these exercise the template + parsing logic directly.
 */
class LobPrintMailAdapterTest {

    private final LobPrintMailAdapter adapter =
            new LobPrintMailAdapter("test_fake_key", new ObjectMapper());

    private static final ToAddress US_RECIPIENT =
            new ToAddress("Jesse Aasman", "2 Oak Ave", null, "Dallas", "TX", "75201", "US");

    private static PostcardRequest request(String templateKey) {
        return request(templateKey, US_RECIPIENT);
    }

    // Overload so tests that only vary the recipient (e.g. international routing) reuse the one
    // canonical fixture instead of re-declaring every field, which would drift over time.
    private static PostcardRequest request(String templateKey, ToAddress to) {
        return new PostcardRequest(
                templateKey,
                "Emily & Jordan",
                "October 4, 2026",
                "https://www.altarwed.com/wedding/emily-jordan",
                "https://cdn.altarwed.com/hero.jpg",
                "Grace Chapel · Austin, TX",
                new FromAddress("Emily Aasman", "1 Main St", null, "Austin", "TX", "78701"),
                to
        );
    }

    // The core regression: Lob requires the 6x11 artwork at the BLEED size (11.25in x 6.25in),
    // not the 11in x 6in trim size. Rendering at trim size 422'd every postcard.
    @Test
    void front_renders_at_lob_bleed_dimensions() {
        String front = adapter.renderFront(request("SAVE_THE_DATE_CLASSIC"));
        assertThat(front).contains("@page { size: 11.25in 6.25in;");
        assertThat(front).contains("width:11.25in; height:6.25in;");
        // The trim size must never reappear: that is exactly the dimension Lob rejects.
        assertThat(front).doesNotContain("size: 11in 6in");
        assertThat(front).doesNotContain("width:11in; height:6in");
    }

    @Test
    void back_renders_at_lob_bleed_dimensions() {
        String back = adapter.renderBack(request("SAVE_THE_DATE_CLASSIC"));
        assertThat(back).contains("@page { size: 11.25in 6.25in;");
        assertThat(back).contains("width:11.25in; height:6.25in;");
        assertThat(back).doesNotContain("size: 11in 6in");
    }

    // Lob requires use_type on every mail piece and 422s without it (the bug this guards against).
    // Our mail is a couple's own save-the-dates/invitations, which is operational correspondence,
    // not marketing, so the value must be exactly "operational".
    @Test
    void request_body_always_sets_operational_use_type() {
        Map<String, Object> body = adapter.buildRequestBody(request("SAVE_THE_DATE_CLASSIC"));
        assertThat(body).containsEntry("use_type", "operational");
    }

    @Test
    void request_body_sets_size_and_domestic_mail_type() {
        Map<String, Object> body = adapter.buildRequestBody(request("SAVE_THE_DATE_CLASSIC"));
        assertThat(body).containsEntry("size", "6x11");
        // US recipient in the fixture: usps_first_class is required for domestic routing.
        assertThat(body).containsEntry("mail_type", "usps_first_class");
        // description is the one field built by string concatenation; lock its exact shape.
        assertThat(body).containsEntry("description", "SAVE_THE_DATE_CLASSIC for Emily & Jordan");
    }

    @Test
    void request_body_omits_mail_type_for_international() {
        ToAddress canadian =
                new ToAddress("Jesse Aasman", "10 King St", null, "Toronto", "ON", "M5H 1A1", "CA");
        Map<String, Object> body =
                adapter.buildRequestBody(request("SAVE_THE_DATE_CLASSIC", canadian));
        // mail_type is US-only; an international recipient must omit it so Lob routes correctly.
        assertThat(body).doesNotContainKey("mail_type");
        // use_type is still required regardless of destination.
        assertThat(body).containsEntry("use_type", "operational");
    }

    @Test
    void front_headline_switches_on_template_key() {
        assertThat(adapter.renderFront(request("SAVE_THE_DATE_CLASSIC"))).contains("Save the Date");
        assertThat(adapter.renderFront(request("INVITATION_CLASSIC"))).contains("You're Invited");
    }

    @Test
    void extractLobError_pulls_the_message_from_lobs_json() {
        String body = "{\"error\":{\"message\":\"front html is not the correct dimensions\",\"status_code\":422}}";
        assertThat(adapter.extractLobError(body)).isEqualTo("front html is not the correct dimensions");
    }

    @Test
    void extractLobError_handles_missing_body() {
        assertThat(adapter.extractLobError(null)).isEqualTo("no error body returned");
        assertThat(adapter.extractLobError("   ")).isEqualTo("no error body returned");
    }

    @Test
    void extractLobError_falls_back_to_capped_raw_body_when_not_json() {
        String notJson = "Bad Gateway".repeat(60); // 660 chars, exceeds the 480 cap
        String result = adapter.extractLobError(notJson);
        assertThat(result).hasSize(480); // fits print_order_recipients.error_message NVARCHAR(500)
        assertThat(notJson).startsWith(result);
    }

    @Test
    void extractLobError_caps_long_provider_messages() {
        // A JSON message longer than the column width must also be capped, not just raw bodies.
        String longMessage = "x".repeat(600);
        String body = "{\"error\":{\"message\":\"" + longMessage + "\",\"status_code\":422}}";
        assertThat(adapter.extractLobError(body)).hasSize(480);
    }
}
