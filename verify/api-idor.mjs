// Cross-access (IDOR) verification. Proves the CoupleAccessGuard:
//   - lets a couple reach their OWN resources (happy path, 200), and
//   - DENIES a couple another couple's resources by path coupleId/websiteId (403).
//
// Requires the stack up + seeded (seed.mjs creates couple A and couple B).
//   node verify/api-idor.mjs

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const cfg = JSON.parse(readFileSync(join(here, 'verify.config.json'), 'utf8'))
const API = cfg.apiUrl

async function login(creds) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: creds.email, password: creds.password }),
  })
  if (!res.ok) throw new Error(`login failed for ${creds.email}: ${res.status} (did you run seed.mjs?)`)
  return res.json()
}

async function status(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.status
}

async function websiteId(userId, token) {
  const res = await fetch(`${API}/api/v1/wedding-websites/couple/${userId}`, { headers: { Authorization: `Bearer ${token}` } })
  return (await res.json()).id
}

let pass = 0, fail = 0
function expect(label, actual, ok) {
  if (ok) { pass++; console.log(`  PASS  ${label}  -> ${actual}`) }
  else { fail++; console.log(`  FAIL  ${label}  -> ${actual}`) }
}
const is = (label, actual, expected) => expect(`${label} (expect ${expected})`, actual, actual === expected)
const denied = (label, actual) => expect(`${label} (expect 401/403)`, actual, actual === 401 || actual === 403)

const a = await login(cfg.couple)
const b = await login(cfg.coupleB)
const aSite = await websiteId(a.userId, a.accessToken)
const bSite = await websiteId(b.userId, b.accessToken)
console.log(`couple A=${a.userId} (site ${aSite})\ncouple B=${b.userId} (site ${bSite})\n`)

console.log('Happy path, couple A token on couple A resources (expect 200):')
is('A couple profile', await status('GET', `/api/v1/couples/${a.userId}`, a.accessToken), 200)
is('A guests',         await status('GET', `/api/v1/guests/couple/${a.userId}`, a.accessToken), 200)
is('A website',        await status('GET', `/api/v1/wedding-websites/couple/${a.userId}`, a.accessToken), 200)
is('A budget',         await status('GET', `/api/v1/budget/couple/${a.userId}`, a.accessToken), 200)
is('A planning-tasks', await status('GET', `/api/v1/planning-tasks/couple/${a.userId}`, a.accessToken), 200)
is('A seating-tables', await status('GET', `/api/v1/seating-tables/couple/${a.userId}`, a.accessToken), 200)
is('A print-orders',   await status('GET', `/api/v1/print-orders/couple/${a.userId}`, a.accessToken), 200)
is('A page-blocks',    await status('GET', `/api/v1/wedding-page-blocks/website/${aSite}`, a.accessToken), 200)
is('A photos',         await status('GET', `/api/v1/wedding-photos/website/${aSite}`, a.accessToken), 200)

console.log('\nIDOR denied, couple A token on couple B resources (expect 403):')
is('B couple profile', await status('GET', `/api/v1/couples/${b.userId}`, a.accessToken), 403)
is('B guests',         await status('GET', `/api/v1/guests/couple/${b.userId}`, a.accessToken), 403)
is('B website',        await status('GET', `/api/v1/wedding-websites/couple/${b.userId}`, a.accessToken), 403)
is('B budget',         await status('GET', `/api/v1/budget/couple/${b.userId}`, a.accessToken), 403)
is('B planning-tasks', await status('GET', `/api/v1/planning-tasks/couple/${b.userId}`, a.accessToken), 403)
is('B seating-tables', await status('GET', `/api/v1/seating-tables/couple/${b.userId}`, a.accessToken), 403)
is('B print-orders',   await status('GET', `/api/v1/print-orders/couple/${b.userId}`, a.accessToken), 403)
is('B ceremony',       await status('GET', `/api/v1/ceremony-sections/couple/${b.userId}`, a.accessToken), 403)
is('B sheet-sync',     await status('GET', `/api/v1/google-sheet-sync/couple/${b.userId}`, a.accessToken), 403)
is('B page-blocks',    await status('GET', `/api/v1/wedding-page-blocks/website/${bSite}`, a.accessToken), 403)
is('B photos',         await status('GET', `/api/v1/wedding-photos/website/${bSite}`, a.accessToken), 403)
// Valid body so the request passes @Valid argument resolution and actually
// reaches the ownership guard (validation runs BEFORE authorization in Spring MVC,
// an empty body would 400 before the guard, masking the real check).
is('B mutate guest',   await status('POST', `/api/v1/guests/couple/${b.userId}`, a.accessToken,
                          { name: 'Intruder', plusOneAllowed: false }), 403)

console.log('\nUnauthenticated (no token, expect 401/403):')
denied('no-token guests', await status('GET', `/api/v1/guests/couple/${a.userId}`, null))

console.log('\nPublic endpoints still open (expect 200), guard must not over-reach:')
is('public slug',      await status('GET', `/api/v1/wedding-websites/slug/${cfg.slug}`, null), 200)
is('public party',     await status('GET', `/api/v1/wedding-party/website/${aSite}`, null), 200)

console.log(`\n  ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
console.log('  PASS: ownership enforced, own access works, cross-access denied, public endpoints open.')
