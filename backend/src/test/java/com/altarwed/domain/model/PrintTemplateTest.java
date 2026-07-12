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
}
