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
 * Security regression tests for issue #351: heroPhotoUrl is fed to Lob's server-side HTML
 * renderer (as a fetched background-image URL) and to next/image, so a non-https scheme/host is
 * an SSRF vector. The @Pattern now requires the https scheme, which blocks file:// and plain-http
 * fetch targets while leaving the normal Azure Blob upload (always https) and the null/empty
 * "clear the hero" cases valid.
 *
 * Uses validateValue so a single property is checked without constructing the ~50-field DTO,
 * matching the Bean-Validation-API-directly style of the other DTO tests in this package.
 */
class UpdateWeddingWebsiteRequestHeroUrlValidationTest {

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

    private Set<ConstraintViolation<UpdateWeddingWebsiteRequest>> validateHeroUrl(String value) {
        return validator.validateValue(UpdateWeddingWebsiteRequest.class, "heroPhotoUrl", value);
    }

    @Test
    void acceptsHttpsBlobUrl() {
        assertThat(validateHeroUrl("https://altarwed.blob.core.windows.net/hero/abc.jpg")).isEmpty();
    }

    @Test
    void acceptsNullAndEmpty_soClearingTheHeroStillWorks() {
        assertThat(validateHeroUrl(null)).isEmpty();
        assertThat(validateHeroUrl("")).isEmpty();
    }

    @Test
    void rejectsFileScheme() {
        assertThat(validateHeroUrl("file:///etc/passwd")).isNotEmpty();
    }

    @Test
    void rejectsPlainHttp_includingInternalMetadataEndpoint() {
        assertThat(validateHeroUrl("http://169.254.169.254/latest/meta-data/")).isNotEmpty();
        assertThat(validateHeroUrl("http://example.com/x.jpg")).isNotEmpty();
    }

    @Test
    void rejectsUrlWithWhitespace_soItCannotBreakOutOfTheCssUrlContext() {
        // A space would let a crafted value inject additional CSS tokens after the url(); the
        // \\S+ requirement forbids it in addition to the escaping already done in the Lob adapter.
        assertThat(validateHeroUrl("https://a.example/x.jpg') url(http://evil")).isNotEmpty();
    }

    @Test
    void rejectsTrailingNewline_whichJavaDollarAnchorWouldOtherwiseAllow() {
        // Regression for the \A...\z anchoring: with ^...$ + Matcher.matches(), Java's $ matches
        // before a final line terminator, so a trailing newline would have slipped through.
        assertThat(validateHeroUrl("https://a.example/x.jpg\n")).isNotEmpty();
    }
}
