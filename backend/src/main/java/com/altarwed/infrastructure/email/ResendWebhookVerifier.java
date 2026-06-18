package com.altarwed.infrastructure.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Base64;

/**
 * Verifies Resend webhook signatures. Resend signs webhooks with Svix: the
 * signature is HMAC-SHA256 over "{svix-id}.{svix-timestamp}.{rawBody}" keyed by
 * the base64 secret (the part after the "whsec_" prefix), base64-encoded, and sent
 * in the {@code svix-signature} header as one or more space-separated "v1,&lt;sig&gt;"
 * entries.
 *
 * Fails closed: an unconfigured or malformed secret rejects every webhook so we
 * never trust an unsigned payload (which could forge bounces and suppress real
 * addresses). The signing secret is a Key Vault value, never hardcoded.
 */
@Component
public class ResendWebhookVerifier {

    private static final Logger log = LoggerFactory.getLogger(ResendWebhookVerifier.class);

    // Reject events whose timestamp is too far from now to blunt replay attacks.
    private static final long TOLERANCE_SECONDS = 5 * 60;
    private static final String SECRET_PREFIX = "whsec_";

    private final byte[] secretKey;
    private final boolean configured;

    public ResendWebhookVerifier(@Value("${altarwed.resend.webhook-secret:}") String secret) {
        byte[] key = null;
        if (secret == null || secret.isBlank()) {
            log.warn("resend webhook secret not configured, delivery webhooks will be rejected");
        } else {
            String base64 = secret.startsWith(SECRET_PREFIX) ? secret.substring(SECRET_PREFIX.length()) : secret;
            try {
                key = Base64.getDecoder().decode(base64);
            } catch (IllegalArgumentException ex) {
                log.warn("resend webhook secret is not valid base64, delivery webhooks will be rejected");
            }
        }
        this.secretKey = key;
        this.configured = key != null && key.length > 0;
    }

    public boolean verify(String svixId, String svixTimestamp, String svixSignature, byte[] rawBody) {
        if (!configured) return false;
        if (svixId == null || svixTimestamp == null || svixSignature == null || rawBody == null) return false;
        if (!timestampWithinTolerance(svixTimestamp)) return false;

        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secretKey, "HmacSHA256"));
            mac.update((svixId + "." + svixTimestamp + ".").getBytes(StandardCharsets.UTF_8));
            mac.update(rawBody);
            String expected = Base64.getEncoder().encodeToString(mac.doFinal());

            // The header may carry several signatures (e.g. during secret rotation);
            // a match against any one is sufficient.
            for (String entry : svixSignature.split(" ")) {
                int comma = entry.indexOf(',');
                String sig = comma >= 0 ? entry.substring(comma + 1) : entry;
                if (constantTimeEquals(sig, expected)) {
                    return true;
                }
            }
            return false;
        } catch (NoSuchAlgorithmException | InvalidKeyException ex) {
            throw new IllegalStateException("HmacSHA256 unavailable", ex);
        }
    }

    private boolean timestampWithinTolerance(String timestamp) {
        try {
            long sent = Long.parseLong(timestamp.trim());
            long now = Instant.now().getEpochSecond();
            return Math.abs(now - sent) <= TOLERANCE_SECONDS;
        } catch (NumberFormatException ex) {
            return false;
        }
    }

    private static boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(
                a.getBytes(StandardCharsets.UTF_8),
                b.getBytes(StandardCharsets.UTF_8));
    }
}
