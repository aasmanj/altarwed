package com.altarwed.application.service;

import com.altarwed.application.dto.ScriptureFeaturedResponse;
import com.altarwed.application.dto.ScriptureVerseResponse;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Service
public class ScriptureService {

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
        var response = restClient.get()
                .uri("/{query}", query)
                .retrieve()
                .body(Map.class);

        if (response == null || !response.containsKey("text")) {
            throw new IllegalArgumentException("Verse not found: " + query);
        }

        String reference = response.containsKey("reference")
                ? (String) response.get("reference")
                : query;
        String text = ((String) response.get("text")).strip();

        return new ScriptureVerseResponse(reference, text);
    }
}
