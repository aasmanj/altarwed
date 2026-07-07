package com.altarwed.infrastructure.security;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * Behavioral proof of issue #41: the rate limiter must key on the client IP
 * Azure App Service itself appends to X-Forwarded-For (the rightmost hop, with
 * its ":port" suffix stripped), not the attacker-controlled leftmost value and
 * not the raw "ip:port" hop, or a caller can trivially get a fresh bucket on
 * every request and nullify throttling entirely. Every test here uses the real
 * Azure format ("ip:port") on the rightmost hop, not a bare IP, since that
 * distinction is exactly what issue #41's fix had to get right.
 */
class RateLimitingFilterTest {

    private static final String PATH = "/api/v1/guests/rsvp/find";

    @Test
    void resolvesTheRealClientIpFromTheRightmostForwardedHop() throws Exception {
        RateLimitingFilter filter = new RateLimitingFilter();
        FilterChain chain = mock(FilterChain.class);

        // An attacker rotates the leftmost, spoofable entry on every request but
        // cannot change what Azure itself appends (the real IP:port, rightmost). A
        // fresh Bucket4j bucket starts FULL at its 10-token burst capacity, so
        // exactly 10 requests succeed before the shared bucket is exhausted.
        for (int i = 0; i < 10; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", PATH);
            request.addHeader("X-Forwarded-For", "9.9.9." + i + ", 203.0.113.7:52344");
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilterInternal(request, response, chain);
        }

        // The 11th request against the SAME real IP (different ephemeral port,
        // as a fresh TCP connection would present) must be throttled. If the
        // filter still keyed on the spoofable leftmost value, OR failed to strip
        // the port from the rightmost hop, this request would earn a brand-new,
        // full bucket and incorrectly succeed.
        MockHttpServletRequest eleventh = new MockHttpServletRequest("GET", PATH);
        eleventh.addHeader("X-Forwarded-For", "9.9.9.99, 203.0.113.7:60001");
        MockHttpServletResponse eleventhResponse = new MockHttpServletResponse();
        filter.doFilterInternal(eleventh, eleventhResponse, chain);

        assertThat(eleventhResponse.getStatus()).isEqualTo(429);
        // Only the first 10 (the burst capacity) were allowed through the chain.
        verify(chain, times(10)).doFilter(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void aFreshTcpConnectionFromTheSameClientCannotEarnANewBucket() throws Exception {
        // The scenario a port-unaware fix would miss entirely: an honest (or
        // automated) client that simply doesn't reuse connections gets a new
        // ephemeral source port from the OS every time, with no header spoofing
        // at all. If the resolved key still carries that port, every single
        // request looks like a brand-new client and throttling never engages.
        RateLimitingFilter filter = new RateLimitingFilter();
        FilterChain chain = mock(FilterChain.class);
        String ip = "203.0.113.201";

        int allowed = 0;
        for (int port = 40000; port < 40015; port++) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", PATH);
            request.addHeader("X-Forwarded-For", ip + ":" + port);
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilterInternal(request, response, chain);
            if (response.getStatus() == 200) allowed++;
        }

        // 15 requests, each from a distinct port, must still be capped at the
        // 10-token burst capacity for this one real IP.
        assertThat(allowed).isEqualTo(10);
    }

    @Test
    void fallsBackToRemoteAddrWhenNoForwardedHeaderIsPresent() throws Exception {
        RateLimitingFilter filter = new RateLimitingFilter();
        FilterChain chain = mock(FilterChain.class);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", PATH);
        request.setRemoteAddr("198.51.100.4");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, chain);

        verify(chain, times(1)).doFilter(request, response);
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void allowsExactlyTheBucketCapacityBeforeThrottling() throws Exception {
        RateLimitingFilter filter = new RateLimitingFilter();
        FilterChain chain = mock(FilterChain.class);
        String ip = "203.0.113.55";

        int allowed = 0;
        int throttled = 0;
        // Burst capacity is 10; hitting the same real IP (varying port, the real
        // Azure format) 12 times must let exactly 10 through and throttle the
        // rest, proving the bucket really is shared and bounded per resolved
        // bare IP, not per raw "ip:port" header value.
        for (int i = 0; i < 12; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", PATH);
            request.addHeader("X-Forwarded-For", "1.1.1." + i + ", " + ip + ":" + (50000 + i));
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilterInternal(request, response, chain);
            if (response.getStatus() == 200) allowed++; else throttled++;
        }

        assertThat(allowed).isEqualTo(10);
        assertThat(throttled).isEqualTo(2);
    }

    // ---- issue #255: extend coverage to the RSVP token-resolution + submit paths ----

    private static final String TOKEN_PATH =
            "/api/v1/guests/rsvp/a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    private static final String SUBMIT_PATH = "/api/v1/guests/rsvp";

    @Test
    void filtersTheRsvpTokenResolutionAndSubmitPaths() {
        // The root cause of issue #255: shouldNotFilter previously only whitelisted
        // /rsvp/find, so the filter was skipped entirely for the token and submit
        // paths. shouldNotFilter must now return false (i.e. DO filter) for both,
        // while still filtering /find and leaving unrelated read paths alone.
        RateLimitingFilter filter = new RateLimitingFilter();

        assertThat(filter.shouldNotFilter(new MockHttpServletRequest("GET", TOKEN_PATH))).isFalse();
        assertThat(filter.shouldNotFilter(new MockHttpServletRequest("POST", SUBMIT_PATH))).isFalse();
        assertThat(filter.shouldNotFilter(new MockHttpServletRequest("GET", PATH))).isFalse();
        // A couple-scoped, JWT-protected guest read is not in scope and stays unfiltered.
        assertThat(filter.shouldNotFilter(
                new MockHttpServletRequest("GET", "/api/v1/guests/couple/abc"))).isTrue();
    }

    @Test
    void rateLimitsTheRsvpTokenResolutionPath() throws Exception {
        // Before issue #255 the filter's shouldNotFilter only covered /rsvp/find,
        // so GET /rsvp/{token} was never throttled and this loop would let all 22
        // requests through. The RSVP tier bucket capacity is 20, so exactly 20 of
        // the same-IP requests succeed and the rest are throttled.
        RateLimitingFilter filter = new RateLimitingFilter();
        FilterChain chain = mock(FilterChain.class);
        String ip = "203.0.113.30";

        int allowed = 0;
        int throttled = 0;
        for (int i = 0; i < 22; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", TOKEN_PATH);
            request.addHeader("X-Forwarded-For", ip + ":" + (50000 + i));
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilterInternal(request, response, chain);
            if (response.getStatus() == 200) allowed++; else throttled++;
        }

        assertThat(allowed).isEqualTo(20);
        assertThat(throttled).isEqualTo(2);
    }

    @Test
    void rateLimitsTheRsvpSubmitPath() throws Exception {
        // POST /rsvp (the submit path) must also be throttled. Capacity 20, same
        // as the GET token path, since both share the RSVP tier.
        RateLimitingFilter filter = new RateLimitingFilter();
        FilterChain chain = mock(FilterChain.class);
        String ip = "203.0.113.31";

        int allowed = 0;
        int throttled = 0;
        for (int i = 0; i < 22; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", SUBMIT_PATH);
            request.addHeader("X-Forwarded-For", ip + ":" + (50000 + i));
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilterInternal(request, response, chain);
            if (response.getStatus() == 200) allowed++; else throttled++;
        }

        assertThat(allowed).isEqualTo(20);
        assertThat(throttled).isEqualTo(2);
    }

    @Test
    void tokenResolutionAndSubmitShareOneRsvpBucketPerIp() throws Exception {
        // The GET token path and POST submit path draw from the SAME per-IP RSVP
        // bucket, so a client cannot double its allowance by alternating verbs.
        // Drain the bucket with 20 GETs, then a POST from the same IP is throttled.
        RateLimitingFilter filter = new RateLimitingFilter();
        FilterChain chain = mock(FilterChain.class);
        String ip = "203.0.113.32";

        for (int i = 0; i < 20; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", TOKEN_PATH);
            request.addHeader("X-Forwarded-For", ip + ":" + (50000 + i));
            filter.doFilterInternal(request, new MockHttpServletResponse(), chain);
        }

        MockHttpServletRequest submit = new MockHttpServletRequest("POST", SUBMIT_PATH);
        submit.addHeader("X-Forwarded-For", ip + ":60123");
        MockHttpServletResponse submitResponse = new MockHttpServletResponse();
        filter.doFilterInternal(submit, submitResponse, chain);

        assertThat(submitResponse.getStatus()).isEqualTo(429);
    }

    @Test
    void theStricterFindBucketIsUnchangedAndSeparateFromTheRsvpBucket() throws Exception {
        // The /find bucket keeps its stricter 10-token limit and is a distinct
        // bucket from the generous RSVP tier: exhausting /find for an IP must not
        // consume any of that IP's RSVP token-resolution allowance.
        RateLimitingFilter filter = new RateLimitingFilter();
        FilterChain chain = mock(FilterChain.class);
        String ip = "203.0.113.33";

        int findAllowed = 0;
        for (int i = 0; i < 12; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", PATH);
            request.addHeader("X-Forwarded-For", ip + ":" + (50000 + i));
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilterInternal(request, response, chain);
            if (response.getStatus() == 200) findAllowed++;
        }
        // /find limit is unchanged at 10.
        assertThat(findAllowed).isEqualTo(10);

        // The same IP still has its full, separate 20-token RSVP bucket.
        MockHttpServletRequest token = new MockHttpServletRequest("GET", TOKEN_PATH);
        token.addHeader("X-Forwarded-For", ip + ":61000");
        MockHttpServletResponse tokenResponse = new MockHttpServletResponse();
        filter.doFilterInternal(token, tokenResponse, chain);

        assertThat(tokenResponse.getStatus()).isEqualTo(200);
    }
}
