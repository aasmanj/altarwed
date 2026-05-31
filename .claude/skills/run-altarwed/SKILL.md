---
name: run-altarwed
description: Launch the full AltarWed stack locally for verification, the Spring Boot backend on a Testcontainers SQL Server, seeded with a known test couple, plus the React SPA and the Next.js public site. Use this to get a running app you can drive (by browser or HTTP) when verifying a change end to end.
---

# run-altarwed

Brings up a complete, seeded AltarWed environment so a change can be observed at
its real surface. This is the launch primitive the `verifier-web` and
`verifier-api` skills build on.

## Prerequisites
- **Docker Desktop must be running** (Testcontainers needs the daemon). On
  Windows, start Docker Desktop and wait for "Engine running".
- First run pulls `mcr.microsoft.com/mssql/server:2022-latest` (~1.5 GB) and
  Chromium for Playwright. Subsequent runs are fast.
- Node 20+, JDK 21 (both already on this machine).

## Bring it up (in order)

### 1. Backend on Testcontainers SQL Server
```bash
cd backend && ./gradlew bootTestRun
```
This runs `TestAltarWedApplication` (src/test), which boots the real app with the
`verify` profile and a throwaway SQL Server container wired via `@ServiceConnection`.
Flyway runs every migration against real SQL Server. Leave it running.

Wait until it is up (first run is slow, the image pull happens before Spring starts):
```bash
# returns {"status":"UP"} once ready
curl -s http://localhost:8080/actuator/health
```
Backend is on **http://localhost:8080**. Swagger: http://localhost:8080/swagger-ui.html

> Persistent-DB alternative (e.g. to inspect rows between runs): use
> `verify/docker-compose.verify.yml` instead, see that file's header. Testcontainers
> is the default and needs no compose file.

### 2. Seed the test couple + wedding
```bash
node verify/seed.mjs
```
Idempotent. Creates `couple@verify.test / VerifyPass123!` with a published wedding
(`the-verify-wedding`), an intentionally empty registry card (for the preview
placeholder check), 5 guests, and 2 seated tables. Re-running is a no-op.

### 3. Point the frontends at the local backend
Create these once (check they don't already hold prod values):
- `frontend-app/.env.local` → `VITE_API_URL=http://localhost:8080`
- `frontend-public/.env.local` → `NEXT_PUBLIC_API_URL=http://localhost:8080`

The `verify` profile already allows CORS from both origins below.

### 4. Frontends
```bash
cd frontend-app && npm run dev      # SPA  -> http://localhost:5173
cd frontend-public && npm run dev   # site -> http://localhost:3000
```

## Surfaces once up
- SPA (authed couple dashboard): http://localhost:5173  (login with the seeded couple)
- Public site: http://localhost:3000/wedding/the-verify-wedding
- Editor preview: http://localhost:3000/preview/the-verify-wedding/registry
- API: http://localhost:8080  (Swagger at /swagger-ui.html)

## Tear down
- Backend: Ctrl-C in the `bootTestRun` terminal. The SQL Server container is
  auto-removed (Testcontainers + Ryuk). No persistent state.

## Gotchas
- `bootTestRun` foregrounds the server; run it in its own terminal/background job.
- If port 1433 is taken (e.g. the compose DB is up), Testcontainers still uses a
  random host port, no conflict. But don't run both DBs if you're low on RAM.
- The Lob/Resend/Azure keys are stubbed in the `verify` profile, no real emails,
  postcards, or blob writes happen. Print orders exercise the idempotency logic
  without mailing anything.
