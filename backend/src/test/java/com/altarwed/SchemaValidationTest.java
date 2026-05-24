package com.altarwed;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Schema validation integration test.
 *
 * What it catches:
 *   - A Flyway migration creates a column with a type that doesn't match the
 *     JPA entity mapping (e.g. NCHAR vs VARCHAR). Hibernate's ddl-auto=validate
 *     rejects the mismatch and the Spring context fails to start.
 *   - A migration adds a column but the entity is never updated (missing field).
 *   - An entity references a table/column that no migration ever created.
 *
 * How it works:
 *   1. The "ci" Spring profile points the datasource at a SQL Server container
 *      on localhost:1433 (spun up by the GitHub Actions workflow).
 *   2. Flyway runs every migration from V1 against that empty database.
 *   3. Hibernate validates every @Entity's column mappings against the resulting
 *      schema. If anything is wrong the context fails to start and this test fails.
 *   4. If contextLoads() is reached, migrations and entity mappings are in sync.
 *
 * Tagged "schema-validation" so the default Gradle test task skips it (no SQL
 * Server needed for unit tests). Run explicitly with:
 *   ./gradlew schemaValidationTest -Dspring.profiles.active=ci
 *
 * The GitHub Actions deploy workflow runs this before every Azure deployment.
 */
@Tag("schema-validation")
@SpringBootTest
@ActiveProfiles("ci")
class SchemaValidationTest {

    @Test
    void contextLoads() {
        // Reaching this line means:
        //   - every Flyway migration executed without error
        //   - Hibernate validated every entity column against the live schema
        // No assertions needed; a startup failure is the signal.
    }
}
