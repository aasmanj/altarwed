package com.altarwed.application.service;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Pins the exact whitelist behavior shared by every admin endpoint (issue #118).
 * Pure JUnit + Mockito, no Spring context: the guard is constructed directly with
 * the CSV the @Value would inject.
 */
class AdminAccessGuardTest {

    private static final String RESOURCE = "/api/v1/admin/test";

    @Test
    void whitelistedEmail_passes() {
        AdminAccessGuard guard = new AdminAccessGuard("founder@altarwed.com");

        assertThatCode(() -> guard.assertAdmin("founder@altarwed.com", RESOURCE))
                .doesNotThrowAnyException();
    }

    @Test
    void nonWhitelistedEmail_isDenied() {
        AdminAccessGuard guard = new AdminAccessGuard("founder@altarwed.com");

        assertThatThrownBy(() -> guard.assertAdmin("stranger@example.com", RESOURCE))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessage("Admin access required");
    }

    @Test
    void nullCallerEmail_isDenied() {
        AdminAccessGuard guard = new AdminAccessGuard("founder@altarwed.com");

        assertThatThrownBy(() -> guard.assertAdmin((String) null, RESOURCE))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void callerEmailCase_isNormalized() {
        AdminAccessGuard guard = new AdminAccessGuard("founder@altarwed.com");

        assertThatCode(() -> guard.assertAdmin("Founder@AltarWed.com", RESOURCE))
                .doesNotThrowAnyException();
    }

    @Test
    void whitelistEntries_areTrimmedAndLowercased() {
        AdminAccessGuard guard = new AdminAccessGuard("  Founder@AltarWed.com , second@altarwed.com  ");

        assertThatCode(() -> guard.assertAdmin("founder@altarwed.com", RESOURCE))
                .doesNotThrowAnyException();
        assertThatCode(() -> guard.assertAdmin("second@altarwed.com", RESOURCE))
                .doesNotThrowAnyException();
    }

    @Test
    void callerEmailWithSurroundingWhitespace_isDenied() {
        // Caller emails are matched exactly (lowercased only, never trimmed): a JWT
        // subject with stray whitespace is not a legitimate admin principal. This pins
        // the pre-refactor strict behavior of all four call sites.
        AdminAccessGuard guard = new AdminAccessGuard("founder@altarwed.com");

        assertThatThrownBy(() -> guard.assertAdmin(" founder@altarwed.com", RESOURCE))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void emptyWhitelist_deniesEveryone() {
        AdminAccessGuard guard = new AdminAccessGuard("");

        assertThatThrownBy(() -> guard.assertAdmin("founder@altarwed.com", RESOURCE))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void blankOnlyWhitelist_deniesEveryone() {
        // Regression pin for the AdminMetricsService drift: its CSV parse kept blank
        // entries, so a misconfigured " , " whitelist contained "". The central guard
        // filters blanks, so no principal can ever match an empty entry.
        AdminAccessGuard guard = new AdminAccessGuard("  ,  , ");

        assertThatThrownBy(() -> guard.assertAdmin("founder@altarwed.com", RESOURCE))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> guard.assertAdmin("", RESOURCE))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void authenticationOverload_extractsPrincipalName() {
        AdminAccessGuard guard = new AdminAccessGuard("founder@altarwed.com");
        Authentication auth = mock(Authentication.class);
        when(auth.getName()).thenReturn("founder@altarwed.com");

        assertThatCode(() -> guard.assertAdmin(auth, RESOURCE)).doesNotThrowAnyException();
    }

    @Test
    void authenticationOverload_nullAuthentication_isDenied() {
        AdminAccessGuard guard = new AdminAccessGuard("founder@altarwed.com");

        assertThatThrownBy(() -> guard.assertAdmin((Authentication) null, RESOURCE))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void authenticationOverload_nullPrincipalName_isDenied() {
        AdminAccessGuard guard = new AdminAccessGuard("founder@altarwed.com");
        Authentication auth = mock(Authentication.class);
        when(auth.getName()).thenReturn(null);

        assertThatThrownBy(() -> guard.assertAdmin(auth, RESOURCE))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void authenticationOverload_nonWhitelisted_isDenied() {
        AdminAccessGuard guard = new AdminAccessGuard("founder@altarwed.com");
        Authentication auth = mock(Authentication.class);
        when(auth.getName()).thenReturn("stranger@example.com");

        assertThatThrownBy(() -> guard.assertAdmin(auth, RESOURCE))
                .isInstanceOf(AccessDeniedException.class);
    }
}
