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
}
