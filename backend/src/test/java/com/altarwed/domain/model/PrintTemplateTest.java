package com.altarwed.domain.model;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure-JUnit domain test for the print templateKey allowlist (issue #352). No Spring context, per
 * backend/CLAUDE.md's domain testing convention.
 */
class PrintTemplateTest {

    @ParameterizedTest
    @ValueSource(strings = {
            "SAVE_THE_DATE_CLASSIC", "SAVE_THE_DATE_PHOTO", "INVITATION_CLASSIC", "INVITATION_PHOTO"
    })
    void isAllowed_acceptsEveryCanonicalTemplateKey(String key) {
        assertThat(PrintTemplate.isAllowed(key)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "save_the_date_classic",              // wrong case is not coerced
            " SAVE_THE_DATE_CLASSIC",             // leading whitespace is not trimmed
            "SAVE_THE_DATE_HACKER",               // plausible-looking but unknown
            "INVITATION_FANCY",                   // unknown style
            "'; DROP TABLE print_orders;--",      // injection-shaped garbage
            "",                                   // blank
            "   "                                 // whitespace only
    })
    void isAllowed_rejectsAnythingNotOnTheAllowlist(String key) {
        assertThat(PrintTemplate.isAllowed(key)).isFalse();
    }

    @Test
    void isAllowed_rejectsNull() {
        assertThat(PrintTemplate.isAllowed(null)).isFalse();
    }

    // ── Issue #362: the new base templates and the PHOTO overlay suffix ─────────────────────────

    @ParameterizedTest
    @ValueSource(strings = {
            "SAVE_THE_DATE_MINIMAL", "INVITATION_MINIMAL",
            "SAVE_THE_DATE_BOTANICAL", "INVITATION_BOTANICAL",
            "SAVE_THE_DATE_DARK_ELEGANT", "INVITATION_DARK_ELEGANT"
    })
    void isAllowed_acceptsEveryNewBaseTemplate(String key) {
        assertThat(PrintTemplate.isAllowed(key)).isTrue();
        assertThat(PrintTemplate.isAllowedTemplateKey(key)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "SAVE_THE_DATE_PHOTO~BOTTOM_CENTER~LIGHT",
            "INVITATION_PHOTO~TOP_LEFT~DARK",
            "INVITATION_PHOTO~MIDDLE_RIGHT~LIGHT",
            "SAVE_THE_DATE_PHOTO~BOTTOM_RIGHT~DARK"
    })
    void isAllowedTemplateKey_acceptsAWellFormedPhotoOverlaySuffix(String key) {
        assertThat(PrintTemplate.isAllowedTemplateKey(key)).isTrue();
        // isAllowed alone (base-only, from #352) must still reject the suffixed form.
        assertThat(PrintTemplate.isAllowed(key)).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "SAVE_THE_DATE_CLASSIC~BOTTOM_CENTER~LIGHT",   // overlay only allowed on a PHOTO base
            "INVITATION_MINIMAL~TOP_LEFT~DARK",            // ditto
            "SAVE_THE_DATE_PHOTO~NOWHERE~LIGHT",           // unknown position
            "SAVE_THE_DATE_PHOTO~BOTTOM_CENTER~NEON",      // unknown theme
            "SAVE_THE_DATE_PHOTO~BOTTOM_CENTER",           // missing theme part
            "SAVE_THE_DATE_PHOTO~BOTTOM_CENTER~LIGHT~X",   // too many parts
            "SAVE_THE_DATE_PHOTO~bottom_center~light",     // wrong case, not coerced
            "SAVE_THE_DATE_HACKER~BOTTOM_CENTER~LIGHT"     // unknown base
    })
    void isAllowedTemplateKey_rejectsAMalformedOrNonPhotoOverlay(String key) {
        assertThat(PrintTemplate.isAllowedTemplateKey(key)).isFalse();
    }

    @Test
    void parse_defaultsBarePhotoKeyToBottomCenterLight() {
        PrintTemplate.Parsed parsed = PrintTemplate.parse("INVITATION_PHOTO");
        assertThat(parsed).isNotNull();
        assertThat(parsed.baseKey()).isEqualTo("INVITATION_PHOTO");
        assertThat(parsed.position()).isEqualTo(PrintTextPosition.BOTTOM_CENTER);
        assertThat(parsed.theme()).isEqualTo(PrintOverlayTextTheme.LIGHT);
        assertThat(parsed.isPhoto()).isTrue();
    }

    @Test
    void parse_readsTheChosenPositionAndTheme() {
        PrintTemplate.Parsed parsed = PrintTemplate.parse("SAVE_THE_DATE_PHOTO~TOP_RIGHT~DARK");
        assertThat(parsed).isNotNull();
        assertThat(parsed.baseKey()).isEqualTo("SAVE_THE_DATE_PHOTO");
        assertThat(parsed.position()).isEqualTo(PrintTextPosition.TOP_RIGHT);
        assertThat(parsed.theme()).isEqualTo(PrintOverlayTextTheme.DARK);
        assertThat(parsed.isSaveTheDate()).isTrue();
    }

    @Test
    void parse_leavesPositionAndThemeNullForANonPhotoBase() {
        PrintTemplate.Parsed parsed = PrintTemplate.parse("SAVE_THE_DATE_MINIMAL");
        assertThat(parsed).isNotNull();
        assertThat(parsed.position()).isNull();
        assertThat(parsed.theme()).isNull();
        assertThat(parsed.isPhoto()).isFalse();
    }

    @Test
    void parse_rejectsAnUnknownKey() {
        assertThat(PrintTemplate.parse("NONSENSE")).isNull();
        assertThat(PrintTemplate.parse(null)).isNull();
    }
}
