package com.altarwed.infrastructure.security;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Resolves the real client IP behind Azure App Service. Shared by
 * {@link RateLimitingFilter} (rate-limit bucket key) and any code that needs to
 * pass a client IP to a third-party verification API (e.g. Turnstile), so the
 * trusted-hop logic exists in exactly one place.
 *
 * Azure App Service terminates the client TCP connection at its own edge and
 * APPENDS the real client IP to X-Forwarded-For rather than replacing it, so
 * the header looks like "&lt;anything the client sent&gt;, &lt;azure-observed-ip&gt;".
 * There is no Front Door / CDN in front of this app service today (single hop),
 * so the LAST entry is the one Azure itself added and is trustworthy; every
 * entry to its left is fully attacker-controlled. Re-verify the hop count if a
 * CDN/Front Door is ever added in front of this app.
 *
 * Azure appends that last entry as "ip:port" (e.g. "203.0.113.7:52344"), not a
 * bare IP -- the client's ephemeral TCP source port, which changes on every new
 * connection. Failing to strip it would let an attacker bypass the rate limiter
 * with nothing more than a fresh (non-keep-alive) connection per request, no
 * header spoofing needed: a different port is a different bucket key.
 */
public final class ClientIpResolver {
    private ClientIpResolver() {}

    public static String resolve(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String[] hops = forwarded.split(",");
            return stripPort(hops[hops.length - 1].trim());
        }
        return request.getRemoteAddr();
    }

    // Strips a trailing ":port" from Azure's appended hop. IPv6 addresses contain
    // colons themselves, so Azure brackets them when a port follows ("[::1]:443");
    // an unbracketed value with more than one colon is a bare IPv6 address (no
    // port attached) and must be left alone.
    private static String stripPort(String hostAndMaybePort) {
        if (hostAndMaybePort.startsWith("[")) {
            int close = hostAndMaybePort.indexOf(']');
            return close >= 0 ? hostAndMaybePort.substring(1, close) : hostAndMaybePort;
        }
        int colonCount = (int) hostAndMaybePort.chars().filter(c -> c == ':').count();
        if (colonCount == 1) {
            return hostAndMaybePort.substring(0, hostAndMaybePort.indexOf(':'));
        }
        return hostAndMaybePort;
    }
}
