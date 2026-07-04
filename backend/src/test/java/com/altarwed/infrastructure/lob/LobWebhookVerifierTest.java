package com.altarwed.infrastructure.lob;

import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests the signature verification that guards the public Lob delivery webhook (issue #52). A
 * forged event could falsely mark a postcard delivered/returned, so a valid signature must pass
 * and any tampering, stale timestamp, or missing secret must fail closed. Mirrors
 * ResendWebhookVerifierTest exactly, differing only in the hex encoding.
 *
 * NOTE: this pins the verifier's own hex-encoding assumption, not Lob's actual live behavior --
 * see LobWebhookVerifier's class javadoc. If Lob's real scheme turns out to use a different
 * encoding, this test (and the implementation) both need updating together.
 */
class LobWebhookVerifierTest {

    private static final String SECRET = "altarwed-test-lob-webhook-secret";

    private String sign(String timestamp, byte[] body) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            mac.update((timestamp + ".").getBytes(StandardCharsets.UTF_8));
            mac.update(body);
            byte[] digest = mac.doFinal();
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    void validSignature_passes() {
        var verifier = new LobWebhookVerifier(SECRET);
        String ts = String.valueOf(Instant.now().getEpochSecond());
        byte[] body = "{\"event_type\":{\"id\":\"postcard.delivered\"}}".getBytes(StandardCharsets.UTF_8);

        assertThat(verifier.verify(sign(ts, body), ts, body))
                .isEqualTo(LobWebhookVerifier.Result.VALID);
    }

    @Test
    void tamperedBody_isBadSignature() {
        var verifier = new LobWebhookVerifier(SECRET);
        String ts = String.valueOf(Instant.now().getEpochSecond());
        byte[] body = "{\"event_type\":{\"id\":\"postcard.delivered\"}}".getBytes(StandardCharsets.UTF_8);
        String signature = sign(ts, body);

        byte[] forged = "{\"event_type\":{\"id\":\"postcard.returned_to_sender\"}}".getBytes(StandardCharsets.UTF_8);
        assertThat(verifier.verify(signature, ts, forged))
                .isEqualTo(LobWebhookVerifier.Result.BAD_SIGNATURE);
    }

    @Test
    void staleTimestamp_isRejected() {
        var verifier = new LobWebhookVerifier(SECRET);
        String ts = String.valueOf(Instant.now().getEpochSecond() - 3600); // an hour old
        byte[] body = "{}".getBytes(StandardCharsets.UTF_8);

        assertThat(verifier.verify(sign(ts, body), ts, body))
                .isEqualTo(LobWebhookVerifier.Result.STALE_TIMESTAMP);
    }

    @Test
    void unconfiguredSecret_isNotConfigured() {
        var verifier = new LobWebhookVerifier("");
        String ts = String.valueOf(Instant.now().getEpochSecond());
        byte[] body = "{}".getBytes(StandardCharsets.UTF_8);

        assertThat(verifier.verify(sign(ts, body), ts, body))
                .isEqualTo(LobWebhookVerifier.Result.NOT_CONFIGURED);
    }

    @Test
    void missingHeaders_areRejected() {
        var verifier = new LobWebhookVerifier(SECRET);
        byte[] body = "{}".getBytes(StandardCharsets.UTF_8);
        assertThat(verifier.verify(null, null, body))
                .isEqualTo(LobWebhookVerifier.Result.MISSING_HEADERS);
    }
}
