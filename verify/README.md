# AltarWed `/verify` harness

A local, seeded, full-stack environment so changes can be **observed running**
(by browser or HTTP), not just typechecked. This is what `/verify` uses to get
past the login wall and the SQL-Server-only backend.

## TL;DR
```bash
# 0. start Docker Desktop (Testcontainers needs the daemon)

# 1. backend on a throwaway SQL Server (leave running)
cd backend && ./gradlew bootTestRun

# 2. seed a known test couple + wedding
node verify/seed.mjs

# 3. browser checks (first time: cd verify && npm install && npx playwright install chromium)
cd verify && npm test

# 3b. or an API-only check
node verify/api-idempotency.mjs
```
Seeded login: `couple@verify.test` / `VerifyPass123!`. For the frontends, see the
`run-altarwed` skill.

## How the database works (Testcontainers)
Testcontainers starts disposable Docker containers from the app's own lifecycle.
We use Spring Boot's **dev-time** flavor:

- `src/test/java/.../TestcontainersConfiguration.java` declares an
  `MSSQLServerContainer` bean annotated `@ServiceConnection`.
- `src/test/java/.../TestAltarWedApplication.java` runs the **real**
  `AltarWedApplication` `.with(TestcontainersConfiguration.class)` under the
  `verify` profile.
- `./gradlew bootTestRun` launches that. Spring starts, Testcontainers pulls and
  runs `mcr.microsoft.com/mssql/server`, and `@ServiceConnection` rewrites
  `spring.datasource.*` to the container's random port, no hardcoded JDBC URL.
- Flyway then runs the **real** SQL-Server migrations (NVARCHAR, `GO` batches,
  filtered unique indexes) against the same dialect as prod. H2 can't do that,
  which is exactly why local verification needed this.
- Ctrl-C and the container is removed (Ryuk cleans up). Nothing persists.

Why this over a hand-managed container: the DB lifecycle is tied to the app, the
port never collides, and there are no stale volumes. If you *want* a persistent DB
(to inspect rows or run `schemaValidationTest`), use `docker-compose.verify.yml`
instead.

## What's here
| Path | What |
|---|---|
| `verify.config.json` | URLs + test-couple creds, single source of truth |
| `seed.mjs` | Idempotent API seed: couple, published wedding (empty registry card on purpose), guests, seated tables |
| `api-idempotency.mjs` | HTTP check: double-POST a print order with one key, assert one order |
| `playwright.config.ts`, `helpers/login.ts`, `checks/*.spec.ts` | Browser checks + evidence screenshots |
| `docker-compose.verify.yml` | Persistent SQL Server alternative to Testcontainers |
| `../backend/src/test/.../Test*.java`, `application-verify.yml` | The `bootTestRun` wiring + stubbed-secret profile |
| `../.claude/skills/{run-altarwed,verifier-web,verifier-api}` | The skills `/verify` discovers |

## Safety
The `verify` profile stubs every external integration, **no real emails (Resend),
postcards (Lob), or blob writes (Azure)** happen. Print-order checks exercise the
order/idempotency logic; recipients come back FAILED because Lob is unconfigured,
which is intended. Never point this profile at a real database or real keys.

## Seeded fixtures (why each exists)
- **Empty registry card block** on the REGISTRY tab → the preview-placeholder
  change is observable (placeholder in editor preview, nothing on the live page).
- **Filled venue + hotel** → the normal card render path.
- **5 guests** (4 with mailing addresses, all with emails) → save-the-dates, RSVP
  invites, and print/communications flows have data.
- **2 tables, 4 seated guests, 1 unassigned** → the printable seating board.
