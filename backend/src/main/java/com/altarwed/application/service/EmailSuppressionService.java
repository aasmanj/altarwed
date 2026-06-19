package com.altarwed.application.service;

import com.altarwed.domain.port.EmailSuppressionPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;

@Service
public class EmailSuppressionService {

    private static final Logger log = LoggerFactory.getLogger(EmailSuppressionService.class);

    private final EmailSuppressionPort suppressionPort;
    private final String secret;

    public EmailSuppressionService(
            EmailSuppressionPort suppressionPort,
            @Value("${altarwed.unsubscribe.secret}") String secret
    ) {
        this.suppressionPort = suppressionPort;
        this.secret = secret;
    }

    /**
     * SHA-256 hex of lowercase-trimmed email. Use this hash as the suppression key
     * and in unsubscribe URLs so the email address never appears in plaintext.
     */
    public static String emailHash(String email) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(email.toLowerCase().trim().getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(64);
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 not available", ex);
        }
    }

    /**
     * HMAC-SHA256 of the emailHash, base64url-encoded without padding.
     * Included in unsubscribe URLs to prevent cross-user suppression.
     */
    public String generateToken(String emailHash) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(emailHash.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException | InvalidKeyException ex) {
            throw new IllegalStateException("HMAC-SHA256 not available", ex);
        }
    }

    /**
     * Constant-time verification of an unsubscribe token. Returns false for any
     * invalid or malformed input so the caller can return a generic response.
     */
    public boolean verifyToken(String emailHash, String token) {
        if (emailHash == null || token == null) return false;
        try {
            String expected = generateToken(emailHash);
            return MessageDigest.isEqual(
                    Base64.getUrlDecoder().decode(expected),
                    Base64.getUrlDecoder().decode(token));
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    @Transactional
    public void suppress(String emailHash, String source) {
        suppressionPort.suppress(emailHash, source);
    }

    public boolean isSuppressed(String emailHash) {
        return suppressionPort.isSuppressed(emailHash);
    }

    /** The suppression source for a hash, or empty if the address is not suppressed. */
    public Optional<String> suppressionSource(String emailHash) {
        return suppressionPort.suppressionSource(emailHash);
    }

    /** Batch hash -> source for the currently-suppressed subset of the given hashes. */
    public Map<String, String> suppressionSources(Collection<String> emailHashes) {
        return suppressionPort.suppressionSources(emailHashes);
    }

    /**
     * Outcome of a resubscribe attempt. {@code NOT_SUPPRESSED} means the address was
     * already deliverable (nothing to do, treated as success by callers);
     * {@code BLOCKED_COMPLAINT} means we refused to reverse a spam complaint.
     */
    public enum ResubscribeOutcome { RESUBSCRIBED, NOT_SUPPRESSED, BLOCKED_COMPLAINT }

    /**
     * Removes an address from the suppression list so it can receive marketing email
     * again, gated on why it was suppressed:
     *   USER_REQUEST / BOUNCE -> resubscribed (a voluntary opt-out being reversed, or a
     *     bounce the couple has confirmed they want to retry).
     *   COMPLAINT -> refused. A spam complaint is a deliverability and legal landmine:
     *     re-mailing a complainer degrades the shared altarwed.com sending reputation for
     *     every couple, so we never auto-reverse it. The recipient must re-engage through
     *     their own mail client (allowlist us) or switch to a different address.
     */
    @Transactional
    public ResubscribeOutcome resubscribe(String emailHash) {
        Optional<String> source = suppressionPort.suppressionSource(emailHash);
        if (source.isEmpty()) {
            return ResubscribeOutcome.NOT_SUPPRESSED;
        }
        if ("COMPLAINT".equalsIgnoreCase(source.get())) {
            // The caller (GuestService) WARN-logs this with guestId/coupleId; keep this
            // at DEBUG so one action produces a single boundary log, not two.
            log.debug("resubscribe refused, reason=prior spam complaint");
            return ResubscribeOutcome.BLOCKED_COMPLAINT;
        }
        // Today the only initiator is a couple acting on a guest's request; the audit
        // row records COUPLE_REQUEST so the timeline shows who reversed the opt-out.
        boolean removed = suppressionPort.unsuppress(emailHash, "COUPLE_REQUEST");
        log.debug("email resubscribe processed, priorSource={}, removed={}", source.get(), removed);
        // A concurrent resubscribe may have removed the row first; report that honestly
        // rather than claiming we reversed a suppression that was already gone.
        return removed ? ResubscribeOutcome.RESUBSCRIBED : ResubscribeOutcome.NOT_SUPPRESSED;
    }
}
