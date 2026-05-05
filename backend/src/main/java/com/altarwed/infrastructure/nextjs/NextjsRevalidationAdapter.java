package com.altarwed.infrastructure.nextjs;

import com.altarwed.domain.port.RevalidationPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class NextjsRevalidationAdapter implements RevalidationPort {

    private static final Logger log = LoggerFactory.getLogger(NextjsRevalidationAdapter.class);

    private final RestClient restClient;
    private final String secret;

    public NextjsRevalidationAdapter(
            @Value("${altarwed.nextjs.base-url}") String nextjsBaseUrl,
            @Value("${altarwed.nextjs.revalidation-secret}") String secret
    ) {
        this.secret = secret;
        this.restClient = RestClient.builder()
                .baseUrl(nextjsBaseUrl)
                .build();
    }

    // Fire-and-forget: revalidation failure must never fail the user's save operation.
    // If Next.js is unreachable, the ISR TTL (60s) acts as the fallback.
    @Override
    public void revalidateWeddingPage(String slug) {
        try {
            restClient.post()
                    .uri("/api/revalidate?secret={secret}&slug={slug}", secret, slug)
                    .retrieve()
                    .toBodilessEntity();
            log.info("[revalidation] Purged /wedding/{}", slug);
        } catch (Exception e) {
            log.warn("[revalidation] Failed to revalidate /wedding/{}: {}", slug, e.getMessage());
        }
    }
}
