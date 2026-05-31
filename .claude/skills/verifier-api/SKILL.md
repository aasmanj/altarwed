---
name: verifier-api
description: HTTP-level verification for AltarWed backend changes (controllers, services, persistence, idempotency, auth). Drives the running Spring Boot API with real requests as the seeded test couple and asserts on responses and DB state, no browser needed. Use when a change is backend-only or when a backend behavior (dedup, validation, an endpoint contract) is the thing to confirm.
---

# verifier-api

Verification for backend changes by driving the **running** API over HTTP. Faster
and more decisive than the browser when the change is server-side.

## Preconditions
Stack up and seeded via the **run-altarwed** skill:
- backend on :8080 (Testcontainers), seeded (`node verify/seed.mjs`)
- (frontends not needed for API checks)

## Bundled check: print-order idempotency
Verifies the dedup guarantee that a double-submit cannot double-charge:
```bash
node verify/api-idempotency.mjs
```
It logs in as the seeded couple, POSTs the same print order twice with one
`idempotencyKey`, and asserts both calls return the same order id and only one row
was created. Safe, the verify profile has no Lob key, so nothing is mailed
(recipients come back FAILED; the order row still dedups, which is the point).

## Writing an API check for the change you're verifying
Reuse the seeded couple + token. Minimal shape (Node 20, global fetch):
```js
import { readFileSync } from 'node:fs'
const cfg = JSON.parse(readFileSync(new URL('./verify.config.json', import.meta.url)))
const login = await fetch(`${cfg.apiUrl}/api/v1/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: cfg.couple.email, password: cfg.couple.password }),
}).then(r => r.json())
const auth = { Authorization: `Bearer ${login.accessToken}`, 'Content-Type': 'application/json' }
// ...drive the endpoint the diff touched, assert on status + body...
```
Browse the contract at http://localhost:8080/swagger-ui.html.

## Probe, don't just confirm
After the happy path, hit the change with the bad input it should reject: wrong
HTTP method, missing required field, oversized body, an id the principal does not
own (IDOR, expect 403/404), a duplicate where uniqueness should hold. One `🔍`
probe minimum. Capture the response body, that is the evidence.

## Reporting
Report inline per the `/verify` format: verdict, steps (each = one request + the
observed status/body), and the decisive response as the evidence block.

## Notes
- `seed.mjs` is idempotent; re-run it any time to reset to a known couple.
- Print/email/blob side-effects are stubbed in the `verify` profile, no real
  postcards, emails, or uploads. Assert on the order/record, not on delivery.
- For schema/migration-only changes (no endpoint), prefer the backend's
  `schemaValidationTest` against `docker-compose.verify.yml`, see that file.
