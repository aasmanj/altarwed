
# Backend, AltarWed API

## Quick Start
- Run: `./gradlew bootRun` (or `gradlew.bat bootRun` on Windows)
- Test: `./gradlew test`
- Build: `./gradlew build`
- New migration: create `V{N+1}__{description}.sql` in `src/main/resources/db/migration/`
- Next migration number: **V52**

## Key Files
- `build.gradle.kts` → all dependencies
- `src/main/resources/application.yml` → config (no secrets, use env vars or Key Vault)
- `src/main/resources/db/migration/` → Flyway migrations V1–V51
- `src/main/java/com/altarwed/AltarWedApplication.java` → main entry point

## Package Structure (Hexagonal Architecture)
```
com.altarwed
  domain/
    model/       → pure Java Records, ZERO Spring/JPA imports
    port/        → plain Java interfaces (EmailPort, VendorRepository, InquiryRepository, ...)
    exception/   → business exceptions extending RuntimeException
  application/
    service/     → orchestrates domain; injects ports, never JPA repos directly
    dto/         → Java Records with Bean Validation; boxed types only (Integer not int)
  infrastructure/
    persistence/ → JPA entities, Spring Data repos, adapter impls of domain ports
    security/    → JWT, UserDetails, SecurityConfig, CoupleAccessGuard, LogSanitizer
    email/       → ResendEmailAdapter (implements EmailPort)
    azure/       → Blob Storage, AzureStorageService
    observability/ → RequestIdFilter (MDC requestId on every request), MdcTaskDecorator
  web/
    controller/  → REST controllers; call services only, never repos
    mapper/      → domain ↔ DTO mapping
    exception/   → GlobalExceptionHandler (@RestControllerAdvice)
    security/    → CoupleAccessGuard (IDOR protection for couple-scoped endpoints)
```

## Auth Flow
1. `POST /api/v1/couples/register` → creates Couple (welcome email sent async), returns 201
2. `POST /api/v1/auth/login` → validates credentials (couple first, then vendor fallback), returns accessToken + refreshToken
3. `POST /api/v1/auth/refresh` → validates refreshToken, returns new accessToken
4. `Authorization: Bearer {accessToken}` on all protected requests
5. `POST /api/v1/auth/vendors/register` → creates Vendor (auto-verified, admin alert sent async)
6. `POST /api/v1/auth/vendors/login` → vendor-specific login
7. `POST /api/v1/auth/forgot-password` + `POST /api/v1/auth/reset-password` → works for both couples and vendors

## Active Services
- `CoupleService` — CRUD for couples, onboarding, account delete
- `WeddingWebsiteService` — website CRUD, block editor, publishing
- `GuestService` — guest list, RSVP, invite tokens, party grouping, "find by name"
- `VendorAuthService` — vendor register + login (auto-verify, admin alert email)
- `VendorService` — profile CRUD, verify/unverify, logo URL update
- `VendorInquiryService` — persist inquiry, list inbox, mark-read (O(1) ownership)
- `PasswordResetService` — shared for couples + vendors (tries couple table, then vendor)
- `MediaUploadService` — Azure Blob upload for hero, wedding-party, album, vendor logo
- `BlogService` — blog CRUD, seeded posts
- `PlanningTaskService` — checklist seeding + CRUD
- `BudgetService` — budget items CRUD
- `SeatingService` — seating tables + guest assignment
- `GoogleSheetSyncService` — 15-min scheduled poll, guest upsert
- `RsvpReminderService` — hourly poll, send reminder emails
- `AdminMetricsService` — funnel analytics, UTM attribution
- `AsyncEmailService` — thin @Async wrapper; ALL email sends go through this

## Important Patterns

### IDOR protection
`CoupleAccessGuard.assertOwns(coupleId, authentication)` — call at the top of every
couple-scoped write endpoint. Logs WARN on mismatch. Template is `GuestController`.

Vendor controllers use `authentication.getName()` to load the vendor by email, then
compare `vendor.id()` against the path/body parameter. See `VendorController` and
the `ownsInquiry()` pattern in `VendorInquiryService`.

### Logging rules (enforced by code-reviewer)
- INFO at boundary events only. WARN for expected failures. ERROR for unexpected.
- Structured args: `log.info("..., id={}", id)` — never string concatenation.
- No PII in logs. Use `LogSanitizer.maskEmail()` for any email in a log arg.
- External calls: INFO before + INFO after success (with provider ID) + ERROR with exception.
- Scheduled jobs: bracket with start/finish/outcome-counts log lines.

### Admin email whitelist
`altarwed.admin.emails` (comma-separated) in application.yml. Used in
`AdminMetricsController` and `AdminVendorController` to gate admin-only endpoints.
Default dev value: `aasmanj@gmail.com`. Prod value in Azure Key Vault.

### Async email
All email sends use `AsyncEmailService` which wraps `EmailPort` with `@Async("emailExecutor")`.
Never call `EmailPort` directly from a service — always go through `AsyncEmailService`.

### New executor beans
Any new `@Bean` executor MUST call `setTaskDecorator(new MdcTaskDecorator())` or the
MDC requestId will vanish on its threads.

## Spring Boot 4 Gotchas (burned us already)
- Package splits: `org.springframework.boot.flyway.autoconfigure.*` (not autoconfigure.flyway)
- `@MockBean` removed → use `@MockitoBean` from `org.springframework.test.context.bean.override.mockito`
- `RestClient.Builder` is NOT a Spring bean — call `RestClient.builder()` as static factory inside constructor
- `ObjectMapper` not auto-exposed — injected via `JacksonConfig.java`

## SQL Server + Flyway DDL Rule
Never add a column and a constraint referencing it as two separate statements in the
same migration. SQL Server resolves names at parse time within a transaction. Use inline:
```sql
-- CORRECT:
ALTER TABLE t ADD col NVARCHAR(3) NULL CONSTRAINT chk_col CHECK (col IN ('a','b'));
```
