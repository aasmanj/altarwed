package com.altarwed.infrastructure.observability;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Behavioral proof of issue #382 (Cache-Control half): the public, unauthenticated GET
 * surface previously emitted no Cache-Control at all, so nothing could be cached by a
 * browser or a future edge/CDN (issue #375 depends on these headers). These tests pin the
 * exact policy each public path receives and, critically, assert that draft/token/auth-
 * adjacent paths get no-store and that write verbs and authenticated endpoints are never
 * given a caching header.
 *
 * Before the fix there was no policy at all, so every assertion here failed (the header was
 * simply absent); after the fix each path resolves to its documented tier.
 */
class PublicCacheControlPolicyTest {

    private final PublicCacheControlPolicy policy = new PublicCacheControlPolicy();

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            // wedding-site data -> short + stale-while-revalidate
            "/api/v1/wedding-websites/slug/jordan-and-bride       | public, max-age=30, stale-while-revalidate=60",
            "/api/v1/wedding-websites/published                   | public, max-age=30, stale-while-revalidate=60",
            "/api/v1/wedding-websites/search                      | public, max-age=30, stale-while-revalidate=60",
            "/api/v1/wedding-websites/abc-123/hotels              | public, max-age=30, stale-while-revalidate=60",
            "/api/v1/wedding-party/website/jordan-and-bride       | public, max-age=30, stale-while-revalidate=60",
            "/api/v1/wedding-photos/website/slug/jordan-and-bride | public, max-age=30, stale-while-revalidate=60",
            "/api/v1/wedding-page-blocks/slug/jordan-and-bride    | public, max-age=30, stale-while-revalidate=60",
            // vendor directory -> fresher than wedding (15s ISR)
            "/api/v1/vendors                                      | public, max-age=15, stale-while-revalidate=60",
            "/api/v1/vendors/some-vendor-id                       | public, max-age=15, stale-while-revalidate=60",
            // long-lived SEO content
            "/api/v1/blog/how-to-choose-an-officiant              | public, max-age=3600, stale-while-revalidate=86400",
            // near-immutable reference data
            "/api/v1/scripture/john/3/16                          | public, max-age=86400, stale-while-revalidate=604800",
            "/api/v1/denominations                                | public, max-age=86400, stale-while-revalidate=604800",
            "/api/v1/denominations/baptist                        | public, max-age=86400, stale-while-revalidate=604800"
    })
    void mapsPublicGetPathToItsTier(String path, String expectedHeader) {
        assertThat(policy.resolve("GET", path)).contains(expectedHeader);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            // draft previews must never cache
            "/api/v1/wedding-websites/preview/some-token",
            "/api/v1/wedding-page-blocks/preview/some-token",
            "/api/v1/wedding-photos/website/preview/some-token",
            // RSVP token reads must never cache
            "/api/v1/guests/rsvp/find",
            "/api/v1/guests/rsvp/some-invite-token",
            // authenticated vendor self endpoints must never cache, even though they sit
            // under the /vendors/** wildcard
            "/api/v1/vendors/me",
            "/api/v1/vendors/me/inquiries"
    })
    void neverCachesSensitivePaths(String path) {
        assertThat(policy.resolve("GET", path)).contains("no-store");
    }

    @ParameterizedTest
    @ValueSource(strings = {"POST", "PUT", "PATCH", "DELETE"})
    void neverCachesWriteVerbsEvenOnCacheablePaths(String method) {
        // /vendors is a cacheable GET path, but a POST to create must never be cached.
        assertThat(policy.resolve(method, "/api/v1/vendors")).isEmpty();
        assertThat(policy.resolve(method, "/api/v1/guests/rsvp")).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            // authenticated couple/vendor dashboard reads are not on the public whitelist,
            // so they must be left completely untouched (no header at all)
            "/api/v1/couples/me",
            "/api/v1/guests",
            "/api/v1/budget-items",
            "/api/v1/planning-tasks",
            "/api/v1/admin/metrics"
    })
    void leavesNonPublicGetsUntouched(String path) {
        assertThat(policy.resolve("GET", path)).isEmpty();
    }

    @Test
    void headIsTreatedLikeGet() {
        assertThat(policy.resolve("HEAD", "/api/v1/blog/some-post"))
                .contains("public, max-age=3600, stale-while-revalidate=86400");
    }

    @Test
    void toleratesNullInputs() {
        assertThat(policy.resolve(null, "/api/v1/vendors")).isEmpty();
        assertThat(policy.resolve("GET", null)).isEmpty();
    }
}
