package com.altarwed.application.service;

import com.altarwed.application.dto.ScriptureFeaturedResponse;
import com.altarwed.application.dto.ScriptureVerseResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;
import java.util.Map;

@Service
public class ScriptureService {

    private static final Logger log = LoggerFactory.getLogger(ScriptureService.class);

    // 15 curated covenant/wedding verses — references only; text fetched on demand
    private static final List<String> FEATURED_REFERENCES = List.of(
            "Genesis 2:24",
            "Ruth 1:16-17",
            "Proverbs 31:10",
            "Song of Solomon 8:6-7",
            "Ecclesiastes 4:9-12",
            "Jeremiah 29:11",
            "Matthew 19:4-6",
            "John 15:12-13",
            "Romans 12:9-10",
            "1 Corinthians 13:4-7",
            "2 Corinthians 6:14",
            "Ephesians 5:25",
            "Colossians 3:14",
            "1 John 4:7-8",
            "Hebrews 13:4"
    );

    private final RestClient restClient;

    public ScriptureService() {
        this.restClient = RestClient.builder()
                .baseUrl("https://bible-api.com")
                .build();
    }

    public ScriptureFeaturedResponse getFeatured() {
        return new ScriptureFeaturedResponse(FEATURED_REFERENCES);
    }

    @SuppressWarnings("unchecked")
    public ScriptureVerseResponse search(String query) {
        log.info("scripture lookup requested, query={}", query);
        Map<String, Object> response;
        try {
            response = restClient.get()
                    .uri("/{query}", query)
                    .retrieve()
                    .body(Map.class);
        } catch (RestClientResponseException ex) {
            log.warn("bible-api rejected lookup, query={}, status={}", query, ex.getStatusCode());
            throw new IllegalArgumentException("Verse not found: " + query);
        } catch (RestClientException ex) {
            log.error("bible-api call failed, query={}", query, ex);
            throw ex;
        }

        if (response == null || !response.containsKey("text")) {
            log.warn("bible-api returned no text, query={}", query);
            throw new IllegalArgumentException("Verse not found: " + query);
        }

        String reference = response.containsKey("reference")
                ? (String) response.get("reference")
                : query;
        String text = ((String) response.get("text")).strip();
        log.info("scripture lookup succeeded, reference={}", reference);

        return new ScriptureVerseResponse(reference, text);
    }
}
