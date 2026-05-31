package com.altarwed;

import org.springframework.boot.SpringApplication;

/**
 * Dev-time launcher for the /verify harness. Boots the REAL application
 * ({@link AltarWedApplication}) but adds {@link TestcontainersConfiguration} so a
 * throwaway SQL Server container backs it.
 *
 * Run it with:
 *   ./gradlew bootTestRun
 *
 * That starts the full backend on http://localhost:8080 against an ephemeral SQL
 * Server, runs every Flyway migration, and stays up so the SPA, the public site,
 * and Playwright can drive it. Stop with Ctrl-C and the container is removed.
 *
 * The "verify" profile (src/test/resources/application-verify.yml) supplies
 * throwaway values for every secret the prod config reads from Key Vault, so the
 * context boots with no real credentials.
 */
public class TestAltarWedApplication {

    public static void main(String[] args) {
        // The verify profile fills in JWT/Resend/Azure placeholders; the datasource
        // is overridden by the Testcontainers @ServiceConnection bean at runtime.
        System.setProperty("spring.profiles.active", "verify");
        SpringApplication.from(AltarWedApplication::main)
                .with(TestcontainersConfiguration.class)
                .run(args);
    }
}
