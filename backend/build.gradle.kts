plugins {
    java
    id("org.springframework.boot") version "4.0.6"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "com.altarwed"
version = "0.0.1-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

configurations {
    compileOnly {
        extendsFrom(configurations.annotationProcessor.get())
    }
}

repositories {
    mavenCentral()
}

val jjwtVersion = "0.12.6"
val springdocVersion = "3.0.0"
val mssqlVersion = "12.8.1.jre11"
val bucket4jVersion = "8.10.1"
val azureStorageVersion = "12.29.0"

dependencies {
    // Web
    implementation("org.springframework.boot:spring-boot-starter-web")

    // Security
    implementation("org.springframework.boot:spring-boot-starter-security")

    // Data / Persistence
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")

    // Flyway, starter ensures Spring Boot 4 autoconfiguration triggers; sqlserver adds T-SQL support
    implementation("org.springframework.boot:spring-boot-starter-flyway")
    implementation("org.flywaydb:flyway-sqlserver")

    // Azure SQL (SQL Server JDBC driver, runtime only, not needed at compile time)
    runtimeOnly("com.microsoft.sqlserver:mssql-jdbc:$mssqlVersion")

    // JWT
    implementation("io.jsonwebtoken:jjwt-api:$jjwtVersion")
    runtimeOnly("io.jsonwebtoken:jjwt-impl:$jjwtVersion")
    runtimeOnly("io.jsonwebtoken:jjwt-jackson:$jjwtVersion")

    // OpenAPI / Swagger UI
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:$springdocVersion")

    // Lombok, compile-time only; annotation processor generates boilerplate
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")

    // Actuator (health checks, metrics for Azure App Insights)
    implementation("org.springframework.boot:spring-boot-starter-actuator")

    // Rate limiting, token bucket algorithm, no Redis required (in-memory per instance)
    implementation("com.bucket4j:bucket4j-core:$bucket4jVersion")

    // Azure Blob Storage, media uploads (wedding photos, wedding party headshots)
    implementation("com.azure:azure-storage-blob:$azureStorageVersion")

    // ---- Test dependencies ----
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.security:spring-security-test")

    // H2 in-memory DB for @DataJpaTest slices
    testRuntimeOnly("com.h2database:h2")

    // Lombok in tests
    testCompileOnly("org.projectlombok:lombok")
    testAnnotationProcessor("org.projectlombok:lombok")
}

// Default test task, unit and application-layer tests only.
// Excludes the schema-validation integration test because that test
// requires a live SQL Server instance (only available in CI).
tasks.withType<Test> {
    useJUnitPlatform {
        excludeTags("schema-validation")
    }
}

// Schema validation task, runs ONLY the @Tag("schema-validation") tests.
// Requires a SQL Server container on localhost:1433 with an empty "altarwed"
// database. The GitHub Actions deploy workflow runs this before every deploy.
// To run locally: ./gradlew schemaValidationTest -Dspring.profiles.active=ci
//   (after: docker run -e ACCEPT_EULA=Y -e SA_PASSWORD=AltarWedCI@2024
//            -p 1433:1433 mcr.microsoft.com/mssql/server:2022-latest)
tasks.register<Test>("schemaValidationTest") {
    description = "Boots the Spring context against a real SQL Server container to validate Flyway migrations and Hibernate entity mappings."
    group = "verification"
    useJUnitPlatform {
        includeTags("schema-validation")
    }
    shouldRunAfter("test")
}
