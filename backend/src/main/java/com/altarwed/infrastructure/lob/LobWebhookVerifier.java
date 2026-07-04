package com.altarwed.infrastructure.lob;

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

/**
 * Verifies Lob webhook signatures (issue #52). Lob signs webhooks by concatenating
 * "{Lob-Signature-Timestamp}.{rawBody}", computing HMAC-SHA256 keyed by the webhook's signing
 * secret (a Key Vault value, never hardcoded), and sending the hex-encoded digest in the
 * {@code Lob-Signature} header. Structurally the same shape as {@code ResendWebhookVerifier}
 * (timestamp + raw body, HMAC-SHA256, replay-window check), differing only in header names and
 * the hex vs base64 encoding.
 *
 * <p><b>Verify this against a real Lob test webhook before relying on it in prod.</b> The hex
 * encoding and header names below are this implementation's best-effort match to Lob's
 * documented scheme, but were not validated against a live Lob-signed request (no live Lob
 * webhook secret was available while writing this). Lob's dashboard can send a manual test event
 * once {@code LOB_WEBHOOK_SECRET} is configured -- if every test event logs
 * {@code BAD_SIGNATURE}, the most likely fix is switching {@link #encode(byte[])} from hex to
 * base64, or adjusting the header names.
 *
 * <p>Fails closed: an unconfigured secret rejects every webhook so we never trust an unsigned
 * payload (which could forge a false "delivered"/"returned_to_sender" status).
 */
@Component
public class LobWebhookVerifier {

    private static final Logger log = LoggerFactory.getLogger(LobWebhookVerifier.class);

    // Reject events whose timestamp is too far from now to blunt replay attacks. Same window as
    // ResendWebhookVerifier; Lob's own docs suggest 5 minutes too.
    private static final long TOLERANCE_SECONDS = 5 * 60;

    private final byte[] secretKey;
    private final boolean configured;

    public LobWebhookVerifier(@Value("${altarwed.lob.webhook-secret:}") String secret) {
        if (secret == null || secret.isBlank()) {
            log.warn("lob webhook secret not configured, delivery webhooks will be rejected");
            this.secretKey = null;
        } else {
            this.secretKey = secret.getBytes(StandardCharsets.UTF_8);
        }
        this.configured = this.secretKey != null && this.secretKey.length > 0;
    }

    /** Outcome of verification, mirrors {@code ResendWebhookVerifier.Result} exactly. */
    public enum Result {
        VALID,
        // No signing secret configured; almost always means LOB_WEBHOOK_SECRET is not set.
        NOT_CONFIGURED,
        // Lob always sends Lob-Signature/Lob-Signature-Timestamp; their absence means the
        // caller is not Lob (or the body never arrived).
        MISSING_HEADERS,
        // Timestamp outside the replay window.
        STALE_TIMESTAMP,
        // Headers present and fresh, but the HMAC does not match: wrong secret or a forgery.
        BAD_SIGNATURE
    }

    public Result verify(String lobSignature, String lobSignatureTimestamp, byte[] rawBody) {
        if (!configured) return Result.NOT_CONFIGURED;
        if (lobSignature == null || lobSignatureTimestamp == null || rawBody == null) return Result.MISSING_HEADERS;
        if (!timestampWithinTolerance(lobSignatureTimestamp)) return Result.STALE_TIMESTAMP;

        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secretKey, "HmacSHA256"));
            mac.update((lobSignatureTimestamp + ".").getBytes(StandardCharsets.UTF_8));
            mac.update(rawBody);
            String expected = encode(mac.doFinal());
            return constantTimeEquals(lobSignature.trim(), expected) ? Result.VALID : Result.BAD_SIGNATURE;
        } catch (NoSuchAlgorithmException | InvalidKeyException ex) {
            throw new IllegalStateException("HmacSHA256 unavailable", ex);
        }
    }

    // See the class javadoc: hex is this implementation's best guess at Lob's actual encoding,
    // isolated in one method so it is a one-line fix if a real test webhook proves it wrong.
    private static String encode(byte[] digest) {
        StringBuilder sb = new StringBuilder(digest.length * 2);
        for (byte b : digest) sb.append(String.format("%02x", b));
        return sb.toString();
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
