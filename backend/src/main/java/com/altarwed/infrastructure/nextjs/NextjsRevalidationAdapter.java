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
        log.info("nextjs revalidation requested, path=/wedding/{}", slug);
        try {
            restClient.post()
                    .uri("/api/revalidate?secret={secret}&slug={slug}", secret, slug)
                    .retrieve()
                    .toBodilessEntity();
            log.info("nextjs revalidation succeeded, path=/wedding/{}", slug);
        } catch (org.springframework.web.client.RestClientResponseException ex) {
            // Provider-level rejection (4xx/5xx). Recoverable: ISR TTL handles fallback.
            log.warn("nextjs revalidation rejected, path=/wedding/{}, status={}",
                    slug, ex.getStatusCode());
        } catch (org.springframework.web.client.RestClientException ex) {
            // Transport failure (network, DNS, timeout). Still recoverable via ISR.
            log.warn("nextjs revalidation transport error, path=/wedding/{}", slug, ex);
        }
    }
}
