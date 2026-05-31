package com.altarwed;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.MSSQLServerContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Dev-time Testcontainers wiring for the /verify harness.
 *
 * The {@code @ServiceConnection} bean tells Spring Boot to start a throwaway SQL
 * Server container and rewrite spring.datasource.* to point at it, so there is no
 * hardcoded JDBC URL and no manual `docker run`. Flyway then runs the real
 * SQL-Server migrations (NVARCHAR, GO batches, filtered indexes) against the same
 * dialect we use in prod, which H2 cannot do.
 *
 * Launched by {@link TestAltarWedApplication} via `./gradlew bootTestRun`.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    MSSQLServerContainer<?> sqlServerContainer() {
        // acceptLicense() is required by the Microsoft EULA. The image is the same
        // family the schema-validation CI job uses (mcr.microsoft.com/mssql/server).
        // The container picks its own strong SA password; @ServiceConnection reads it.
        return new MSSQLServerContainer<>(
                DockerImageName.parse("mcr.microsoft.com/mssql/server:2022-latest"))
                .acceptLicense();
    }
}
