package com.altarwed.infrastructure.security;

import com.altarwed.domain.exception.CaptchaUnavailableException;
import com.altarwed.domain.port.CaptchaVerificationPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

// Cloudflare Turnstile verification for the RSVP find-invitation endpoint (issue
// #89): a human check on the one unauthenticated endpoint that mints an RSVP
// capability token from a bare name match, so scripted mass-enumeration of a
// wedding's guest list is impractical even if the name-match/rate-limit
// defenses are ever eroded.
@Component
public class CloudflareTurnstileAdapter implements CaptchaVerificationPort {

    private static final Logger log = LoggerFactory.getLogger(CloudflareTurnstileAdapter.class);
    private static final String VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

    private final String secretKey;
    private final boolean failClosed;
    private final RestClient restClient;

    // failClosed is profile-driven, not env-driven: application.yml sets it true only in the
    // prod profile document (the same mechanism that disables Swagger in prod), so no deploy
    // environment can toggle it by accident and local/CI need no configuration at all.
    public CloudflareTurnstileAdapter(
            @Value("${altarwed.turnstile.secret-key:}") String secretKey,
            @Value("${altarwed.turnstile.fail-closed:false}") boolean failClosed) {
        this.secretKey = secretKey;
        this.failClosed = failClosed;
        this.restClient = RestClient.builder().build();
        if ((secretKey == null || secretKey.isBlank()) && !failClosed) {
            log.warn("turnstile captcha disabled, no altarwed.turnstile.secret-key configured");
        }
        // The blank-and-fail-closed case logs at ERROR in TurnstileStartupValidator, which owns
        // the loud launch-gate message; no duplicate log here.
    }

    @Override
    public boolean verify(String token, String remoteIp) {
        if (secretKey == null || secretKey.isBlank()) {
            // Fail-closed profile (prod, issue #413): a blank secret must reject rather than
            // silently disabling the human-check that #89's threat model assumes is live.
            // Thrown, not returned false, so the web layer can answer 503 (operator problem,
            // retry later) instead of 400 (caller problem, retry now).
            if (failClosed) {
                log.warn("turnstile verification rejected, reason=fail-closed with no secret configured");
                throw new CaptchaUnavailableException();
            }
            // Not configured elsewhere (local/dev/CI, or before the Cloudflare site exists):
            // verify everything rather than breaking the feature. Once the secret is set (Key
            // Vault in prod) verification activates automatically, no code change needed.
            return true;
        }
        if (token == null || token.isBlank()) {
            log.warn("turnstile verification rejected, reason=missing token");
            return false;
        }

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("secret", secretKey);
        form.add("response", token);
        if (remoteIp != null && !remoteIp.isBlank()) {
            form.add("remoteip", remoteIp);
        }

        try {
            TurnstileResponse result = restClient.post()
                    .uri(VERIFY_URL)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(TurnstileResponse.class);
            boolean success = result != null && Boolean.TRUE.equals(result.success());
            if (!success) {
                log.warn("turnstile verification rejected, reason=provider declined");
            }
            return success;
        } catch (RestClientResponseException ex) {
            // Provider-level rejection (4xx/5xx from Cloudflare itself, e.g. bad secret).
            log.error("turnstile verification http error, status={}", ex.getStatusCode(), ex);
            return false;
        } catch (RestClientException ex) {
            // Transport failure (network, DNS, timeout). Fail closed: a Cloudflare
            // outage must not itself become the way a scraper gets through unchecked.
            log.error("turnstile verification transport error", ex);
            return false;
        }
    }

    // Only the field this adapter needs; Cloudflare's response carries more
    // (error-codes, challenge_ts, action, cdata) that we don't act on.
    private record TurnstileResponse(Boolean success) {}
}
