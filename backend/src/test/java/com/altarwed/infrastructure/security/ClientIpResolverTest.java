package com.altarwed.infrastructure.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue #41: Azure App Service appends the real client hop to X-Forwarded-For as
 * "ip:port", not a bare IP. The ephemeral source port changes on every new TCP
 * connection, so failing to strip it would let a rate-limit key drift on every
 * request even with a completely honest client, and would hand Turnstile a
 * malformed remoteip. These tests lock in the resolved value being a bare host,
 * ready to key a bucket map or pass to a third-party verification API.
 */
class ClientIpResolverTest {

    @Test
    void stripsThePortAzureAppendsToTheRealClientHop() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-For", "9.9.9.9, 203.0.113.7:52344");

        assertThat(ClientIpResolver.resolve(request)).isEqualTo("203.0.113.7");
    }

    @Test
    void theSameClientOnANewTcpConnectionResolvesToTheSameIp() {
        // A fresh (non-keep-alive) connection gets a new ephemeral port from the
        // OS on every request; the resolved value must not follow it.
        MockHttpServletRequest first = new MockHttpServletRequest();
        first.addHeader("X-Forwarded-For", "1.1.1.1, 203.0.113.7:52344");
        MockHttpServletRequest second = new MockHttpServletRequest();
        second.addHeader("X-Forwarded-For", "1.1.1.1, 203.0.113.7:60000");

        assertThat(ClientIpResolver.resolve(first)).isEqualTo(ClientIpResolver.resolve(second));
    }

    @Test
    void leavesABareIpv4HopWithNoPortUnchanged() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-For", "203.0.113.7");

        assertThat(ClientIpResolver.resolve(request)).isEqualTo("203.0.113.7");
    }

    @Test
    void stripsThePortFromABracketedIpv6Hop() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-For", "[2001:db8::1]:443");

        assertThat(ClientIpResolver.resolve(request)).isEqualTo("2001:db8::1");
    }

    @Test
    void leavesABareIpv6HopWithNoPortUnchanged() {
        // A bare IPv6 address contains multiple colons and no brackets; it must
        // not be mistaken for a "host:port" pair and truncated.
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-For", "2001:db8::1");

        assertThat(ClientIpResolver.resolve(request)).isEqualTo("2001:db8::1");
    }

    @Test
    void fallsBackToRemoteAddrWhenNoForwardedHeaderIsPresent() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("198.51.100.4");

        assertThat(ClientIpResolver.resolve(request)).isEqualTo("198.51.100.4");
    }
}
