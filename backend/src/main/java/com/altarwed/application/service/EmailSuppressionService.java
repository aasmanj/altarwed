package com.altarwed.application.service;

import com.altarwed.domain.port.CoupleEmailOptOutPort;
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
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Couple-aware email suppression facade. There are two kinds of suppression:
 *   - GLOBAL (address-level): permanent bounces and spam complaints, in EmailSuppressionPort.
 *     They apply to an address across every couple and protect the shared sending domain.
 *   - PER-COUPLE (relationship-level): a guest's voluntary unsubscribe from ONE couple's
 *     wedding mail, in CoupleEmailOptOutPort. The Knot/Zola model: unsubscribing from one
 *     wedding does not silence another.
 * An address is suppressed for a given couple's send when EITHER applies. Resubscribe is
 * recipient-initiated (the guest RSVPs); it clears their per-couple opt-out (and a legacy
 * global voluntary opt-out), never a bounce/complaint.
 */
@Service
public class EmailSuppressionService {

    private static final Logger log = LoggerFactory.getLogger(EmailSuppressionService.class);

    private final EmailSuppressionPort suppressionPort;
    private final CoupleEmailOptOutPort optOutPort;
    private final String secret;

    public EmailSuppressionService(
            EmailSuppressionPort suppressionPort,
            CoupleEmailOptOutPort optOutPort,
            @Value("${altarwed.unsubscribe.secret}") String secret
    ) {
        this.suppressionPort = suppressionPort;
        this.optOutPort = optOutPort;
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
     * HMAC-SHA256 over the unsubscribe payload, base64url without padding. The payload
     * binds the couple so a token minted for one couple's link cannot be replayed against
     * another. A null coupleId yields the legacy hash-only payload, so unsubscribe links
     * already sitting in guests' inboxes keep verifying.
     */
    public String generateToken(String emailHash, UUID coupleId) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(unsubscribeTokenPayload(emailHash, coupleId).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException | InvalidKeyException ex) {
            throw new IllegalStateException("HMAC-SHA256 not available", ex);
        }
    }

    /**
     * The exact string the unsubscribe HMAC signs. The adapter that MINTS the link and
     * this service that VERIFIES it both call this one method, so the format cannot drift
     * between them (a drift would silently break every unsubscribe link). A null coupleId
     * yields the legacy hash-only payload for couple-agnostic mail (welcome) and links
     * minted before per-couple scoping.
     */
    public static String unsubscribeTokenPayload(String emailHash, UUID coupleId) {
        return coupleId == null ? emailHash : emailHash + ":" + coupleId;
    }

    /** Constant-time verification of an unsubscribe token. False for any malformed input. */
    public boolean verifyToken(String emailHash, UUID coupleId, String token) {
        if (emailHash == null || token == null) return false;
        try {
            String expected = generateToken(emailHash, coupleId);
            return MessageDigest.isEqual(
                    Base64.getUrlDecoder().decode(expected),
                    Base64.getUrlDecoder().decode(token));
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    /** True if the address is suppressed for this couple (globally OR per-couple). */
    public boolean isSuppressed(UUID coupleId, String emailHash) {
        return suppressionPort.isSuppressed(emailHash) || optOutPort.isOptedOut(coupleId, emailHash);
    }

    /** Global suppression from a bounce/complaint webhook (address-level, couple-agnostic). */
    @Transactional
    public void suppressGlobal(String emailHash, String source) {
        suppressionPort.suppress(emailHash, source);
    }

    /** Per-couple voluntary unsubscribe from a footer link that carried couple context. */
    @Transactional
    public void coupleUnsubscribe(UUID coupleId, String emailHash) {
        optOutPort.optOut(coupleId, emailHash);
    }

    /**
     * Backward-compat unsubscribe for a footer link with no couple context (welcome mail,
     * or links sent before the per-couple model). Records a global voluntary opt-out.
     */
    @Transactional
    public void globalUnsubscribe(String emailHash) {
        suppressionPort.suppress(emailHash, "USER_REQUEST");
    }

    /**
     * Recipient-initiated resubscribe, called when a guest RSVPs. Clears their per-couple
     * opt-out and any legacy global voluntary opt-out. Never clears a bounce/complaint, so
     * a deliverability suppression survives. Returns true if anything was cleared.
     */
    @Transactional
    public boolean resubscribeOnRsvp(UUID coupleId, String emailHash) {
        boolean clearedCouple = optOutPort.removeOptOut(coupleId, emailHash);
        boolean clearedLegacy = suppressionPort.clearLegacyUserRequest(emailHash);
        boolean cleared = clearedCouple || clearedLegacy;
        if (cleared) {
            log.info("guest resubscribed via rsvp, coupleId={}", coupleId);
        }
        return cleared;
    }

    /**
     * The badge reason for one address under one couple: a global bounce/complaint/legacy
     * opt-out (its stored source) takes precedence; otherwise a per-couple opt-out reads
     * as USER_REQUEST; otherwise null (deliverable).
     */
    public String reasonFor(UUID coupleId, String emailHash) {
        Optional<String> global = suppressionPort.suppressionSource(emailHash);
        if (global.isPresent()) return global.get();
        return optOutPort.isOptedOut(coupleId, emailHash) ? "USER_REQUEST" : null;
    }

    /**
     * Batch version of {@link #reasonFor} for a guest list. Two queries (global sources +
     * this couple's opt-outs), merged so a global reason wins over a per-couple one.
     */
    public Map<String, String> reasonsByHash(UUID coupleId, Collection<String> emailHashes) {
        if (emailHashes == null || emailHashes.isEmpty()) return Map.of();
        Map<String, String> globalSources = suppressionPort.suppressionSources(emailHashes);
        Set<String> coupleOptedOut = optOutPort.optedOutHashes(coupleId, emailHashes);
        Map<String, String> out = new HashMap<>(globalSources);
        for (String hash : coupleOptedOut) {
            out.putIfAbsent(hash, "USER_REQUEST"); // global reason wins if both present
        }
        return out;
    }
}
