package com.altarwed.application.dto;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.util.Set;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * Validation tests for issue #457: heroLayout gains a third allowlisted value, "names-below",
 * so the couple names can render in a block beneath the hero photo instead of over it. The
 * @Pattern is the server-side allowlist that stops a crafted PATCH from writing a raw CSS/HTML
 * value into the column that the public renderer keys on, so it must accept the three known
 * layouts and reject everything else (while null stays valid for patch "no change" semantics).
 *
 * Uses validateValue so a single property is checked without constructing the ~50-field DTO,
 * matching the Bean-Validation-API-directly style of the other DTO tests in this package.
 */
class UpdateWeddingWebsiteRequestHeroLayoutValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    private Set<ConstraintViolation<UpdateWeddingWebsiteRequest>> validateHeroLayout(String value) {
        return validator.validateValue(UpdateWeddingWebsiteRequest.class, "heroLayout", value);
    }

    @Test
    void acceptsNamesBelow() {
        assertThat(validateHeroLayout("names-below")).isEmpty();
    }

    @Test
    void acceptsExistingFullAndFramed() {
        assertThat(validateHeroLayout("full")).isEmpty();
        assertThat(validateHeroLayout("framed")).isEmpty();
    }

    @Test
    void acceptsNull_soPatchNoChangeStillWorks() {
        assertThat(validateHeroLayout(null)).isEmpty();
    }

    @Test
    void rejectsUnknownLayout() {
        assertThat(validateHeroLayout("invalid")).isNotEmpty();
    }

    @Test
    void rejectsHostileValue_soItCannotReachThePublicStyleSink() {
        assertThat(validateHeroLayout("\"></style><script>")).isNotEmpty();
    }
}
