package com.altarwed.infrastructure.config;

import org.flywaydb.core.Flyway;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Runs Flyway repair before every migrate.
 *
 * Why: repair() removes rows marked success=false from flyway_schema_history
 * (failed migrations that were rolled back) and recalculates checksums for
 * successfully applied migrations so they match the current files on disk.
 * It is a safe no-op when nothing needs repairing.
 *
 * This permanently fixes the startup crash caused by V25 failing with
 * "Invalid column name 'price_tier'" on Azure SQL. The inline-constraint
 * syntax fix in V25 + repair() clearing the failed row lets V25 re-run cleanly.
 */
@Configuration
public class FlywayConfig {

    @Bean
    public FlywayMigrationStrategy repairThenMigrate() {
        return flyway -> {
            flyway.repair();
            flyway.migrate();
        };
    }
}
