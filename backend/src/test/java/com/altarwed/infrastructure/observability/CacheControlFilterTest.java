package com.altarwed.infrastructure.observability;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * Proves the filter actually writes (or withholds) the Cache-Control header on the real
 * servlet response and always continues the chain. The path-to-policy mapping itself is
 * exhaustively covered by {@link PublicCacheControlPolicyTest}; this class verifies the
 * servlet wiring, including context-path stripping.
 */
class CacheControlFilterTest {

    private final CacheControlFilter filter = new CacheControlFilter(new PublicCacheControlPolicy());

    @Test
    void setsCacheControlOnPublicWeddingGet() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/wedding-websites/slug/jordan");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(request, response, chain);

        assertThat(response.getHeader("Cache-Control")).isEqualTo("public, max-age=30, stale-while-revalidate=60");
        verify(chain, times(1)).doFilter(request, response);
    }

    @Test
    void setsNoStoreOnPreviewGet() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/wedding-websites/preview/tok");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(request, response, chain);

        assertThat(response.getHeader("Cache-Control")).isEqualTo("no-store");
    }

    @Test
    void leavesAuthenticatedGetWithoutCacheControl() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/guests");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(request, response, chain);

        assertThat(response.getHeader("Cache-Control")).isNull();
        verify(chain, times(1)).doFilter(request, response);
    }

    @Test
    void stripsContextPathBeforeMatching() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/app/api/v1/blog/a-post");
        request.setContextPath("/app");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(request, response, chain);

        assertThat(response.getHeader("Cache-Control")).isEqualTo("public, max-age=3600, stale-while-revalidate=86400");
    }
}
