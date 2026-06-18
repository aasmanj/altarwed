package com.altarwed.infrastructure.email;

import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests the Svix signature verification that guards the public delivery webhook.
 * This is a security boundary: a forged event could suppress real guests, so a
 * valid signature must pass and any tampering, stale timestamp, or missing secret
 * must fail closed.
 */
class ResendWebhookVerifierTest {

    private static final byte[] KEY = "altarwed-test-signing-key-material".getBytes(StandardCharsets.UTF_8);
    private static final String SECRET = "whsec_" + Base64.getEncoder().encodeToString(KEY);

    private String sign(String id, String timestamp, byte[] body) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(KEY, "HmacSHA256"));
            mac.update((id + "." + timestamp + ".").getBytes(StandardCharsets.UTF_8));
            mac.update(body);
            return "v1," + Base64.getEncoder().encodeToString(mac.doFinal());
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    void validSignature_passes() {
        var verifier = new ResendWebhookVerifier(SECRET);
        String id = "msg_1";
        String ts = String.valueOf(Instant.now().getEpochSecond());
        byte[] body = "{\"type\":\"email.delivered\"}".getBytes(StandardCharsets.UTF_8);

        assertThat(verifier.verify(id, ts, sign(id, ts, body), body)).isTrue();
    }

    @Test
    void tamperedBody_fails() {
        var verifier = new ResendWebhookVerifier(SECRET);
        String id = "msg_1";
        String ts = String.valueOf(Instant.now().getEpochSecond());
        byte[] body = "{\"type\":\"email.delivered\"}".getBytes(StandardCharsets.UTF_8);
        String header = sign(id, ts, body);

        byte[] forged = "{\"type\":\"email.bounced\"}".getBytes(StandardCharsets.UTF_8);
        assertThat(verifier.verify(id, ts, header, forged)).isFalse();
    }

    @Test
    void staleTimestamp_fails() {
        var verifier = new ResendWebhookVerifier(SECRET);
        String id = "msg_1";
        String ts = String.valueOf(Instant.now().getEpochSecond() - 3600); // an hour old
        byte[] body = "{\"type\":\"email.delivered\"}".getBytes(StandardCharsets.UTF_8);

        assertThat(verifier.verify(id, ts, sign(id, ts, body), body)).isFalse();
    }

    @Test
    void unconfiguredSecret_failsClosed() {
        var verifier = new ResendWebhookVerifier("");
        String id = "msg_1";
        String ts = String.valueOf(Instant.now().getEpochSecond());
        byte[] body = "{}".getBytes(StandardCharsets.UTF_8);

        assertThat(verifier.verify(id, ts, sign(id, ts, body), body)).isFalse();
    }

    @Test
    void missingHeaders_fail() {
        var verifier = new ResendWebhookVerifier(SECRET);
        byte[] body = "{}".getBytes(StandardCharsets.UTF_8);
        assertThat(verifier.verify(null, null, null, body)).isFalse();
    }
}
