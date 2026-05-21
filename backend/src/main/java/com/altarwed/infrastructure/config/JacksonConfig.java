package com.altarwed.infrastructure.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Registers a shared ObjectMapper bean.
 *
 * Spring Boot 4 no longer auto-exposes ObjectMapper as an injectable bean
 * the way Boot 3 did via JacksonAutoConfiguration. Declaring it explicitly
 * here makes it available for constructor injection in any @Service (e.g.
 * BlockBackfillService uses it to serialize block contentJson).
 *
 * JavaTimeModule: serializes LocalDate/LocalDateTime as ISO strings instead
 * of a timestamp array. WRITE_DATES_AS_TIMESTAMPS disabled for the same reason.
 */
@Configuration
public class JacksonConfig {

    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }
}
