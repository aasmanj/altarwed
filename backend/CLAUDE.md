
# Backend, AltarWed API

Java 21 (virtual threads, Records, pattern matching) · Spring Boot 4.0.6 · Gradle Kotlin DSL ·
Spring Security 7 · Spring Data JPA + Flyway · Azure SQL (SQL Server dialect) · Azure Blob ·
SpringDoc OpenAPI.

## Quick Start
- Run: `./gradlew bootRun` (or `gradlew.bat bootRun` on Windows)
- Test: `./gradlew test`
- Build: `./gradlew build`
- **Schema / domain entities -- see `backend/docs/SCHEMA.md`** (read on demand).

## Flyway migrations
- Location: `src/main/resources/db/migration/`, named `V{N}__{description}.sql`.
- **Next migration number = highest `V{n}` in that directory + 1.** Always check the
  directory; NEVER trust a hardcoded number (it drifts). Verify before creating one.
- ALL schema changes go through Flyway. NEVER use `spring.jpa.hibernate.ddl-auto=create/update`
  in any environment. Migrations are versioned and irreversible.
- UUID primary keys on all tables.

### SQL Server + Flyway DDL rule
Never add a column and a constraint referencing it as two separate statements in the same
migration. SQL Server resolves names at parse time within a transaction. Use inline syntax:
```sql
-- WRONG (separate statements in same transaction):
ALTER TABLE t ADD col NVARCHAR(3) NULL;
ALTER TABLE t ADD CONSTRAINT chk_col CHECK (col IN ('a','b'));

-- CORRECT (single statement, inline constraint):
ALTER TABLE t ADD col NVARCHAR(3) NULL CONSTRAINT chk_col CHECK (col IN ('a','b'));
```

## Key Files
- `build.gradle.kts` -- all dependencies
- `src/main/resources/application.yml` -- config (no secrets, use env vars or Key Vault)
- `src/main/resources/db/migration/` -- Flyway migrations
- `src/main/resources/logback-spring.xml` -- single source of truth for log format/MDC
- `src/main/java/com/altarwed/AltarWedApplication.java` -- main entry point

## Architecture: Hexagonal (Ports & Adapters) -- NON-NEGOTIABLE

### The Dependency Rule (NEVER violate)
```
web -> application -> domain <- infrastructure
```
`domain` has ZERO imports from Spring, JPA, infrastructure, or web. If you find yourself
importing `springframework.*` in `domain/`, STOP and restructure.

### Package structure
```
com.altarwed
  domain/
    model/       -- pure Java Records, ZERO Spring/JPA imports. Ever.
    port/        -- plain Java interfaces (EmailPort, VendorRepository, InquiryRepository, ...)
    exception/   -- business exceptions extending RuntimeException
  application/
    service/     -- orchestrates domain; injects ports, never JPA repos directly. @Transactional on writes.
    dto/         -- Java Records with Bean Validation; boxed types only (Integer not int)
  infrastructure/
    persistence/ -- JPA entities (@Entity, classes never Records), Spring Data repos, adapter impls of domain ports
    security/    -- JWT, UserDetails, SecurityConfig, CoupleAccessGuard, LogSanitizer
    email/       -- ResendEmailAdapter (implements EmailPort)
    azure/       -- Blob Storage, AzureStorageService
    observability/ -- RequestIdFilter (MDC requestId on every request), MdcTaskDecorator
  web/
    controller/  -- REST controllers; call services only, never repos. All under /api/v1/
    mapper/      -- domain <-> DTO mapping
    exception/   -- GlobalExceptionHandler (@RestControllerAdvice)
    security/    -- CoupleAccessGuard (IDOR protection for couple-scoped endpoints)
```

Always separate the JPA entity from the domain model; write a mapper (toDomain / toEntity) in
the adapter class. Never put `@Entity` on a domain Record. Never import `infrastructure.*` in
`domain.*` or `web.*` in `application.*`. Never call a JPA repository from a controller.

## Code Standards (Java / Gradle)

### Java
- DTOs MUST be Java Records (not classes).
- Constructor injection ONLY (never `@Autowired` on fields).
- `@Transactional` on service methods that write to DB.
- Domain models are immutable Java Records. JPA entities are classes with `@Entity`.
- API versioning: all endpoints under `/api/v1/`.
- **Use boxed types (Integer, Boolean) in DTOs, never primitives.** Primitives can't represent
  "not provided" in JSON; Jackson fails rather than defaulting.
- Never use `RestTemplate` for new code (use `RestClient` or `@HttpExchange`).

### Gradle
- Use `implementation` / `compileOnly` / `runtimeOnly` / `testImplementation` correctly.
- Lombok: `compileOnly` + `annotationProcessor`. JDBC drivers: `runtimeOnly`. Test libs: `testImplementation`.

### Testing
- `domain/` tests: pure JUnit 5, no Spring context.
- `application/` tests: Mockito mocks, no Spring context.
- `web/` tests: `@WebMvcTest` slice only. `infrastructure/` tests: `@DataJpaTest` with H2.
- Target: 80% coverage on `application/service/`.
- Note SB4 test-slice caveats below (`@DataJpaTest`/`@WebMvcTest` removed from the SB4
  autoconfigure jar -- avoid Spring test slices for now; prefer Mockito).

## Spring Boot 4, CRITICAL BREAKING CHANGES (burned us already, never repeat)

SB4 split the old `spring-boot-autoconfigure` monolith into per-technology modules. **Always
use the new packages; the old ones DO NOT EXIST in 4.x:**

| What | Old (SB3) WRONG | New (SB4) CORRECT |
|---|---|---|
| Flyway autoconfigure | `org.springframework.boot.autoconfigure.flyway.*` | `org.springframework.boot.flyway.autoconfigure.*` |
| JPA/Hibernate autoconfigure | `org.springframework.boot.autoconfigure.orm.jpa.*` | `org.springframework.boot.hibernate.autoconfigure.*` |
| Security autoconfigure | `org.springframework.boot.autoconfigure.security.*` | `org.springframework.boot.security.autoconfigure.*` |
| Web autoconfigure | `org.springframework.boot.autoconfigure.web.*` | check `spring-boot-web` module |

**Test annotation changes (SB4 removed these, use Spring Framework 7 replacements):**
- `@MockBean` -- **REMOVED**. Use `@MockitoBean` from `org.springframework.test.context.bean.override.mockito`.
- `@DataJpaTest`, `@WebMvcTest` -- **REMOVED** from the SB4 autoconfigure jar. Avoid Spring test slices for now.

**Beans SB3 auto-exposed but SB4 does NOT (declare explicitly):**
- `ObjectMapper` -- declared in `JacksonConfig.java`. Inject via constructor where needed.
- `RestClient.Builder` -- NOT a Spring bean in SB4. Never inject it as a constructor param.
  Call `RestClient.builder()` as a static factory inside the constructor (see
  ResendEmailAdapter, NextjsRevalidationAdapter, ScriptureService).
- When adding any new `@Service` with non-obvious deps, verify each dep resolves as a bean
  before deploying.

**If you get "package org.springframework.boot.autoconfigure.X does not exist":**
1. Find the actual jar: `jar tf ~/.gradle/caches/.../spring-boot-X-4.0.6.jar | grep ClassName`
2. The new package is almost always `org.springframework.boot.X.autoconfigure.*`.

## Auth Flow
1. `POST /api/v1/couples/register` -- creates Couple (welcome email async), returns 201
2. `POST /api/v1/auth/login` -- validates credentials (couple first, then vendor fallback), returns accessToken + refreshToken
3. `POST /api/v1/auth/refresh` -- validates refreshToken, returns new accessToken
4. `Authorization: Bearer {accessToken}` on all protected requests
5. `POST /api/v1/auth/vendors/register` -- creates Vendor (auto-verified, admin alert async)
6. `POST /api/v1/auth/vendors/login` -- vendor-specific login
7. `POST /api/v1/auth/forgot-password` + `POST /api/v1/auth/reset-password` -- couples and vendors

## Security Rules
- Passwords hashed with BCrypt (strength 12). JWT signed with HS256.
- JWT principal is the email string; userId is a custom claim via `JwtService.extractUserId()`.
- CSRF disabled (stateless REST). CORS for frontend origins only. Rate limiting via Bucket4j
  (in-memory, per instance). Swagger/OpenAPI disabled in prod profile.
- Never store plain text passwords. Never hardcode secrets, API keys, or connection strings.
- Never use `WebSecurityConfigurerAdapter` (removed in Spring Security 6+); `SecurityFilterChain` only.

### Public endpoint whitelist (everything else requires auth)
```
POST /api/v1/auth/**, POST /api/v1/couples/register, POST /api/v1/vendors/register,
GET  /api/v1/vendors/**, GET /api/v1/denominations/**,
GET  /api/v1/wedding-websites/slug/**, GET /api/v1/wedding-websites/published,
GET  /api/v1/wedding-websites/search, GET /api/v1/wedding-websites/*/hotels,
GET  /api/v1/guests/rsvp/**, POST /api/v1/guests/rsvp,
GET  /api/v1/wedding-party/website/**, GET /api/v1/wedding-photos/website/slug/**,
GET  /api/v1/wedding-page-blocks/slug/**, GET /api/v1/blog/**,
GET  /api/v1/wedding-websites/preview/**, GET /api/v1/wedding-page-blocks/preview/**,
GET  /api/v1/wedding-photos/website/preview/**,
POST /api/v1/inquiries, GET /api/v1/scripture/**
```

### IDOR protection
`CoupleAccessGuard.assertOwns(coupleId, authentication)` -- call at the top of every
couple-scoped write endpoint. Logs WARN on mismatch. Template is `GuestController`.
Vendor controllers use `authentication.getName()` to load the vendor by email, then compare
`vendor.id()` against the path/body parameter (see `VendorController`, `ownsInquiry()` in
`VendorInquiryService`).

## Active Services
- `CoupleService` -- CRUD, onboarding, account delete
- `WeddingWebsiteService` -- website CRUD, block editor, publishing
- `GuestService` -- guest list, RSVP, invite tokens, party grouping, "find by name"
- `VendorAuthService` -- vendor register + login (auto-verify, admin alert email)
- `VendorService` -- profile CRUD, verify/unverify, logo URL update
- `VendorInquiryService` -- persist inquiry, list inbox, mark-read (O(1) ownership)
- `PasswordResetService` -- shared for couples + vendors (tries couple table, then vendor)
- `MediaUploadService` -- Azure Blob upload for hero, wedding-party, album, vendor logo
- `BlogService`, `PlanningTaskService`, `BudgetService`, `SeatingService`
- `GoogleSheetSyncService` -- 15-min scheduled poll, guest upsert
- `RsvpReminderService` -- hourly poll, send reminder emails
- `AdminMetricsService` -- funnel analytics, UTM attribution
- `AsyncEmailService` -- thin @Async wrapper; ALL email sends go through this
- `StripeService` -- vendor subscription billing (Phase 8): Checkout session, Customer Portal,
  and webhook handling with idempotent, state-convergent upserts (signature verified in `StripeAdapter`, raw `byte[]` body preserved)

### Patterns
- **Async email:** all sends use `AsyncEmailService` (`@Async("emailExecutor")` wrapping
  `EmailPort`). Never call `EmailPort` directly from a service.
- **New executor beans:** any new `@Bean` executor MUST call
  `setTaskDecorator(new MdcTaskDecorator())` or the MDC requestId vanishes on its threads.
- **Admin whitelist:** `altarwed.admin.emails` (comma-separated) in application.yml gates
  admin endpoints. Dev default `aasmanj@gmail.com`; prod value in Key Vault.

## Observability Rules (logs reach Azure Application Insights)

App Service ships SLF4J logs to App Insights via MDC parsing of stdout. Logs are the only
window into prod; add them deliberately. Enforced by the `code-reviewer` agent.

**DB disaster recovery (PITR restore, cutover, bad-migration playbook, quarterly drill): see `backend/docs/DR-RUNBOOK.md`.**

1. **Log levels (strict).** INFO at boundary events only (HTTP write-endpoint entry, just
   before an external call, just after a durable side-effect commits, scheduled-job
   start/finish, auth events). WARN for recoverable per-item failures in a batch, expected
   domain-rule rejections (RSVP token expired, invite-cap exceeded), retries. ERROR for
   unexpected exceptions / unrecoverable state only (ERROR pages on-call; don't cry wolf).
   DEBUG is fine in code but disabled in prod.
2. **Structured args, never concatenation.** `log.info("order failed, orderId={}, coupleId={}",
   orderId, coupleId)` -- App Insights parses `{}` into typed, indexable columns. Never `"Order " + id`.
3. **Message style:** `noun verb [state]` lowercase (`"print order submitted"`,
   `"guest invite issued"`) so Kusto prefix-search works.
4. **Correlation IDs (MDC).** Every request auto-gets `requestId` (`RequestIdFilter`), on every
   log line and the `X-Request-Id` header. Add the domain-scoped ID as a structured arg:
   HTTP write endpoints -- `coupleId`/`vendorId`; scheduled jobs -- `jobRunId = UUID.randomUUID()`;
   `@Async` tasks -- MDC propagates via `MdcTaskDecorator` on `emailExecutor`.
5. **External integrations (Lob, Resend, Stripe, Azure Blob, Next.js revalidate, bible-api,
   Google Sheets) MUST log a triplet:** INFO before the call; INFO after success (with the
   provider's ID); WARN on expected rejection (handle, don't rethrow as ERROR); ERROR on
   unexpected failure passing the **exception as the last arg**, then rethrow. In high-throughput
   batches downgrade per-item success to DEBUG and emit one aggregate INFO.
6. **Auth/security events (always INFO or WARN).** INFO: login success (masked email, role,
   userId), token refresh, password-reset request (masked email), logout, vendor approval change.
   WARN: login failure (masked email + reason), revoked/expired token refresh, bad reset token,
   IDOR attempt, rate-limit hit, JWT signature failure. Never silently `return 401`; log first.
   IP addresses allowed ONLY in security-audit lines (rate-limit, brute-force, IDOR).
7. **Scheduled jobs / async.** Bracket every `@Scheduled` with `runId = UUID.randomUUID()`:
   INFO start; INFO finish with outcome counts (`processed`, `failed`) + `durationMs`; ERROR
   crash with partial counts + exception as last arg, then rethrow.
8. **NEVER log:** PII (emails, addresses, phones, guest/partner names, payment details, photos,
   IPs unless security-audit), secrets (JWT contents, refresh tokens raw/hashed, passwords,
   API keys, connection strings, webhook payloads), bulk data (full request/response bodies,
   DB rows, file contents). Use internal UUIDs. If you must log an email for audit, log only
   the prefix before `@` via `LogSanitizer.maskEmail()` (`j***@altarwed.com`).
9. **Cost.** App Insights bills per GB. Never log inside a `for`/`while` loop (log the
   aggregate); no verbose INFO on hot paths.
10. **Exceptions:** pass as the **last arg**, no format specifier: `log.error("payment failed,
    orderId={}", id, ex)`. Never `log.error(ex.getMessage())`. Don't log AND rethrow unless
    adding context.
11. **Config** lives in `logback-spring.xml` (format, MDC fields, async appender, per-package
    levels). Keep logging config out of `application.yml` beyond root level + spring tuning.
12. **Reviewer flags:** zero logs in a new service/controller/adapter/job; `entering`/`exiting`
    noise; concatenation; logging `ex.getMessage()`; PII in any arg; an external integration
    missing the triplet; a scheduled job missing start/finish/counts; a WARN for something
    working as designed (warning fatigue).

## Environment Variable Rules (enforced by code-reviewer)

A missing env var with no default in `application.yml` crashes the JVM at startup before the
health endpoint exists -- instant 503, no logs. Happened in prod 2026-06-05
(`UNSUBSCRIBE_SECRET`, `POSTAL_ADDRESS`).

1. **Every `@Value` must have a safe default unless the missing value is truly fatal.**
   ```yaml
   # WRONG -- crashes at startup if absent:
   secret: ${SOME_SECRET}
   # RIGHT -- degrades gracefully; feature fails at runtime, not startup:
   secret: ${SOME_SECRET:}
   ```
   No default IS correct for: DB URL, DB credentials, JWT secret (app can't function). A
   default IS required for anything whose absence breaks one feature (email footer, pixel IDs,
   integration keys, webhook secrets). Log a WARN at startup if a critical-but-not-fatal var is empty.
2. **Every new env var must be added to `infrastructure/modules/app-service.bicep` in the same
   PR.** Code referencing a new env var (`@Value`, `System.getenv`, `application.yml`) without a
   matching `appSettings` entry works locally and crashes in prod on next deploy. Reviewer flags:
   any new `@Value("${X}")` without a default where X is not in the Bicep; any new `${X}` in
   `application.yml`; any new application property without a matching Bicep entry (or a comment
   explaining why it is local-only).

## Roles
COUPLE (manage wedding, guests, ceremony, vendor messaging) · VENDOR (listing, inquiries,
analytics) · ADMIN (platform management, partial).
