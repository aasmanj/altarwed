package com.altarwed;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.MSSQLServerContainer;
import org.testcontainers.utility.DockerImageName;

import java.time.Duration;

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
        // azure-sql-edge is Microsoft's lighter SQL engine, it boots reliably in a
        // memory-constrained Docker VM (~3-4 GB) where full mssql/server OOMs. It
        // speaks the same TDS/T-SQL, so the JDBC driver and our migrations work
        // unchanged. asCompatibleSubstituteFor lets MSSQLServerContainer drive it.
        //
        // Fidelity note: the CI schemaValidationTest still runs full SQL Server 2022,
        // so the real-dialect schema gate before deploy is unchanged. This image is
        // only for the local /verify harness. To use full SQL Server here instead,
        // give Docker >= 6 GB and swap the image line back.
        //
        // acceptLicense() sets ACCEPT_EULA=Y (required by both images). The container
        // picks its own strong SA password; @ServiceConnection reads it.
        // 10-minute timeout: SQL Server's FIRST-boot init (copying system DBs) is
        // glacial on slow Docker/WSL2 disk, observed ~6-7 min on a constrained
        // laptop. The default/shorter timeout gives up mid-init and you get a
        // "prelogin response, 0 bytes" failure. This pays the slow boot once; the
        // server then stays up for the whole verify session.
        return new MSSQLServerContainer<>(
                DockerImageName.parse("mcr.microsoft.com/azure-sql-edge:latest")
                        .asCompatibleSubstituteFor("mcr.microsoft.com/mssql/server"))
                .acceptLicense()
                .withStartupTimeout(Duration.ofMinutes(10));
    }
}
