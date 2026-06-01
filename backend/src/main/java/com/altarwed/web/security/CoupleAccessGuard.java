package com.altarwed.web.security;

import com.altarwed.domain.model.Couple;
import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import com.altarwed.infrastructure.observability.LogSanitizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Central authorization guard for couple-owned resources.
 *
 * Every authenticated couple-scoped endpoint must call {@link #assertOwns} (for a
 * path coupleId) or {@link #assertOwnsWebsite} (for a path websiteId) so a couple
 * can only touch their OWN data. Without it, any logged-in couple could read or
 * modify another couple's resources by changing the path id (IDOR), guest PII
 * included.
 *
 * The principal is the email String set by JwtAuthenticationFilter (NOT a
 * UserDetails). Rejections are WARN-logged as the security-audit trail
 * (CLAUDE.md observability rule 6; email masked per rule 8). All denials throw
 * AccessDeniedException, mapped to 403 by GlobalExceptionHandler.
 */
@Component
public class CoupleAccessGuard {

    private static final Logger log = LoggerFactory.getLogger(CoupleAccessGuard.class);

    private final CoupleRepository coupleRepository;
    private final WeddingWebsiteRepository websiteRepository;

    public CoupleAccessGuard(CoupleRepository coupleRepository, WeddingWebsiteRepository websiteRepository) {
        this.coupleRepository = coupleRepository;
        this.websiteRepository = websiteRepository;
    }

    /**
     * Returns the authenticated couple's id (throws if unauthenticated/unknown).
     * Use for endpoints scoped by a resource id (not a path coupleId), the
     * service then filters the resource by this id so cross-couple access is a
     * no-op (treated as not-found, no existence leak).
     */
    public UUID requireCoupleId(String email) {
        return authenticatedCoupleId(email);
    }

    /** Asserts the authenticated principal owns {@code coupleId}. */
    public void assertOwns(UUID coupleId, String email) {
        UUID authenticated = authenticatedCoupleId(email);
        if (!authenticated.equals(coupleId)) {
            log.warn("access denied, reason=idor, actor={}, targetCoupleId={}",
                     LogSanitizer.maskEmail(email), coupleId);
            throw new AccessDeniedException("Access denied");
        }
    }

    /** Asserts the authenticated principal owns the couple that owns {@code websiteId}. */
    public void assertOwnsWebsite(UUID websiteId, String email) {
        UUID ownerCoupleId = websiteRepository.findById(websiteId)
                .map(WeddingWebsite::coupleId)
                .orElseThrow(() -> {
                    // Deny rather than 404 so a couple can't probe which websiteIds exist.
                    log.warn("access denied, reason=website not found, actor={}, websiteId={}",
                             LogSanitizer.maskEmail(email), websiteId);
                    return new AccessDeniedException("Access denied");
                });
        assertOwns(ownerCoupleId, email);
    }

    private UUID authenticatedCoupleId(String email) {
        if (email == null) {
            log.warn("access denied, reason=unauthenticated");
            throw new AccessDeniedException("Unauthenticated");
        }
        return coupleRepository.findByEmail(email)
                .map(Couple::id)
                .orElseThrow(() -> {
                    log.warn("access denied, reason=unknown principal, actor={}", LogSanitizer.maskEmail(email));
                    return new AccessDeniedException("Unknown principal");
                });
    }
}
