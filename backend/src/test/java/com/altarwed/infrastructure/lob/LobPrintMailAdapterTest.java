package com.altarwed.infrastructure.lob;

import com.altarwed.domain.port.PrintMailPort.AddressVerificationResult;
import com.altarwed.domain.port.PrintMailPort.FromAddress;
import com.altarwed.domain.port.PrintMailPort.PostcardRequest;
import com.altarwed.domain.port.PrintMailPort.ToAddress;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
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
        return request(templateKey, to, null, null, null);
    }

    // Full overload for tests that exercise the card shape (cardSize) and the couple's own
    // scripture (verseText/verseReference).
    private static PostcardRequest request(String templateKey, ToAddress to,
                                           String cardSize, String verseText, String verseReference) {
        return new PostcardRequest(
                templateKey,
                "Emily & Jordan",
                "October 4, 2026",
                "https://www.altarwed.com/wedding/emily-jordan",
                "https://cdn.altarwed.com/hero.jpg",
                "Grace Chapel · Austin, TX",
                new FromAddress("Emily Aasman", "1 Main St", null, "Austin", "TX", "78701"),
                to,
                cardSize,
                verseText,
                verseReference
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
        String back = adapter.renderBack(request("SAVE_THE_DATE_CLASSIC"), null);
        assertThat(back).contains("@page { size: 11.25in 6.25in;");
        assertThat(back).contains("width:11.25in; height:6.25in;");
        assertThat(back).doesNotContain("size: 11in 6in");
    }

    // Same 422-class regression guard as above, now for the portrait shapes couples can choose.
    // Each MUST render at the exact Lob bleed size documented in dimsFor: 6x9 -> 6.25in x 9.25in,
    // 5x7 -> 5.25in x 7.25in. A wrong dimension 422s every postcard of that shape.
    @Test
    void portrait_6x9_renders_at_lob_bleed_dimensions() {
        PostcardRequest req = request("SAVE_THE_DATE_CLASSIC", US_RECIPIENT, "PORTRAIT_6X9", null, null);
        assertThat(adapter.renderFront(req)).contains("@page { size: 6.25in 9.25in;");
        assertThat(adapter.renderFront(req)).contains("width:6.25in; height:9.25in;");
        assertThat(adapter.renderBack(req, null)).contains("@page { size: 6.25in 9.25in;");
        assertThat(adapter.buildRequestBody(req)).containsEntry("size", "6x9");
    }

    @Test
    void portrait_5x7_renders_at_lob_bleed_dimensions() {
        PostcardRequest req = request("INVITATION_CLASSIC", US_RECIPIENT, "PORTRAIT_5X7", null, null);
        assertThat(adapter.renderFront(req)).contains("@page { size: 5.25in 7.25in;");
        assertThat(adapter.renderFront(req)).contains("width:5.25in; height:7.25in;");
        assertThat(adapter.renderBack(req, null)).contains("@page { size: 5.25in 7.25in;");
        assertThat(adapter.buildRequestBody(req)).containsEntry("size", "5x7");
    }

    // An unknown or null card_size must collapse to the proven 6x11 landscape, never 422 the order.
    @Test
    void unknown_card_size_falls_back_to_landscape_6x11() {
        PostcardRequest req = request("SAVE_THE_DATE_CLASSIC", US_RECIPIENT, "PORTRAIT_9X12", null, null);
        assertThat(adapter.buildRequestBody(req)).containsEntry("size", "6x11");
        assertThat(adapter.renderFront(req)).contains("width:11.25in; height:6.25in;");
    }

    // Portrait backs reserve the BOTTOM for Lob's address block (a top message band), not the
    // right half the landscape back uses -- rendering the landscape .left strip on a 6.25in-wide
    // portrait card would leave no room to address it.
    @Test
    void portrait_back_uses_top_message_band_not_landscape_left_strip() {
        String back = adapter.renderBack(request("SAVE_THE_DATE_CLASSIC", US_RECIPIENT, "PORTRAIT_6X9", null, null), null);
        assertThat(back).contains(".top {");
        assertThat(back).doesNotContain("width:5.5in");
    }

    // Family feedback: the couple's OWN scripture must print, and it must be visually distinct.
    @Test
    void front_prints_couples_own_verse_when_present() {
        String front = adapter.renderFront(
                request("SAVE_THE_DATE_PHOTO", US_RECIPIENT, null, "Two are better than one.", "Ecclesiastes 4:9"));
        assertThat(front).contains("Two are better than one.");
        assertThat(front).contains("Ecclesiastes 4:9");
        // Distinct verse color so it doesn't blend into the names on the photo scrim.
        assertThat(front).contains(".verse { font-size:11pt; color:#f0c674;");
    }

    @Test
    void front_falls_back_to_default_verse_when_couple_has_none() {
        String front = adapter.renderFront(request("SAVE_THE_DATE_CLASSIC", US_RECIPIENT, null, "  ", null));
        assertThat(front).contains("Above all, love each other deeply.");
        assertThat(front).contains("1 Peter 4:8");
    }

    // The photo front must put text in a bottom scrim band and NOT darken the whole photo, so the
    // couple's faces stay clear (family feedback: "words aren't over your beautiful faces").
    @Test
    void photo_front_anchors_text_to_a_bottom_scrim_band() {
        String front = adapter.renderFront(request("SAVE_THE_DATE_PHOTO", US_RECIPIENT, null, null, null));
        assertThat(front).contains(".scrim {");
        // The old full-card darkening overlay is gone: the faces above the band are no longer dimmed.
        assertThat(front).doesNotContain(".overlay {");
        // Content is anchored to the bottom of the card, not vertically centered over the photo.
        assertThat(front).contains(".content { position:absolute; left:0; right:0; bottom:0;");
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

    @Test
    void deriveDeliveryStatus_uses_the_most_recent_tracking_event() {
        // Lob orders tracking_events ascending by time, so the last one is the latest scan.
        Map<String, Object> postcard = Map.of("tracking_events", List.of(
                Map.of("name", "Mailed"),
                Map.of("name", "In Transit"),
                Map.of("name", "Delivered")
        ));
        assertThat(adapter.deriveDeliveryStatus(postcard)).isEqualTo("Delivered");
    }

    @Test
    void deriveDeliveryStatus_returns_sent_when_scheduled_but_no_usps_scan_yet() {
        // No USPS scans yet (always the case in test mode), but Lob scheduled a delivery date.
        // This matches Lob's dashboard "Total Sent" category.
        Map<String, Object> postcard = Map.of(
                "tracking_events", List.of(),
                "expected_delivery_date", "2026-07-15");
        assertThat(adapter.deriveDeliveryStatus(postcard)).isEqualTo("Sent");
    }

    @Test
    void deriveDeliveryStatus_is_null_when_nothing_is_known() {
        // Freshly created, not yet scheduled: leave the existing status untouched.
        assertThat(adapter.deriveDeliveryStatus(Map.of("status", "rendered"))).isNull();
    }

    @Test
    void deriveDeliveryStatus_caps_event_name_to_the_column_width() {
        Map<String, Object> postcard = Map.of("tracking_events", List.of(
                Map.of("name", "x".repeat(50))));
        assertThat(adapter.deriveDeliveryStatus(postcard)).hasSize(32);
    }

    // Issue #59: pre-payment address verification (Lob's us_verifications product).

    @Test
    void buildVerificationRequestBody_mapsAddressFields() {
        Map<String, Object> body = adapter.buildVerificationRequestBody(US_RECIPIENT);
        assertThat(body).containsEntry("primary_line", "2 Oak Ave");
        assertThat(body).containsEntry("city", "Dallas");
        assertThat(body).containsEntry("state", "TX");
        assertThat(body).containsEntry("zip_code", "75201");
        assertThat(body).doesNotContainKey("secondary_line");
    }

    @Test
    void buildVerificationRequestBody_includesSecondaryLineWhenPresent() {
        ToAddress withUnit = new ToAddress("Jesse Aasman", "2 Oak Ave", "Apt 4", "Dallas", "TX", "75201", "US");
        Map<String, Object> body = adapter.buildVerificationRequestBody(withUnit);
        assertThat(body).containsEntry("secondary_line", "Apt 4");
    }

    @Test
    void classifyDeliverability_rejectsOnlyUndeliverable() {
        AddressVerificationResult result = adapter.classifyDeliverability(Map.of("deliverability", "undeliverable"));
        assertThat(result.deliverable()).isFalse();
        assertThat(result.reason()).isNotBlank();
    }

    @Test
    void classifyDeliverability_acceptsDeliverableWithMinorUnitDiscrepancies() {
        // These three are still genuinely USPS-deliverable per Lob's own docs, just with a unit
        // mismatch/missing/incorrect -- must not block the couple's order or the charge.
        assertThat(adapter.classifyDeliverability(Map.of("deliverability", "deliverable")).deliverable()).isTrue();
        assertThat(adapter.classifyDeliverability(Map.of("deliverability", "deliverable_unnecessary_unit")).deliverable()).isTrue();
        assertThat(adapter.classifyDeliverability(Map.of("deliverability", "deliverable_incorrect_unit")).deliverable()).isTrue();
        assertThat(adapter.classifyDeliverability(Map.of("deliverability", "deliverable_missing_unit")).deliverable()).isTrue();
    }

    @Test
    void classifyDeliverability_failsOpenOnMissingOrUnrecognizedValue() {
        // A verification-schema surprise must not block the whole order; Lob's own
        // postcard-creation rejection remains the fallback safety net.
        assertThat(adapter.classifyDeliverability(new HashMap<>()).deliverable()).isTrue();
        assertThat(adapter.classifyDeliverability(Map.of("deliverability", "something_new")).deliverable()).isTrue();
        assertThat(adapter.classifyDeliverability(null).deliverable()).isTrue();
    }
}
