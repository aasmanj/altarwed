package com.altarwed.domain.port;

public interface ConversionEventPort {

    /**
     * Report a Lead conversion event to the upstream ad platform.
     * Implementations MUST be no-ops when the platform is not configured.
     *
     * @param emailHash       SHA-256 hex of the lowercase-trimmed email
     * @param eventSourceUrl  Canonical URL of the page that triggered the action
     * @param coupleId        Internal couple UUID (used as event dedup id)
     */
    void reportLead(String emailHash, String eventSourceUrl, String coupleId);
}
