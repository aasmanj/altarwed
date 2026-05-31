// Verifies the print-order idempotency change at the HTTP surface: two POSTs with
// the SAME idempotency key create exactly ONE order (no double mail/charge).
//
// Safe to run: the verify profile has no Lob key, so postcards are never mailed,
// each recipient comes back FAILED ("Lob not configured") while the ORDER row is
// still created. That is fine, this checks dedup of the order, not Lob delivery.
//
// Run after the stack is up and seeded:  node verify/api-idempotency.mjs

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const cfg = JSON.parse(readFileSync(join(here, 'verify.config.json'), 'utf8'))
const API = cfg.apiUrl
let token = null

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { status: res.status, ok: res.ok, data }
}

function fail(msg, detail) {
  console.error(`\n  FAIL: ${msg}`)
  if (detail !== undefined) console.error('  detail:', JSON.stringify(detail))
  process.exit(1)
}

const login = await api('POST', '/api/v1/auth/login', { email: cfg.couple.email, password: cfg.couple.password })
if (!login.ok) fail('login failed (did you run seed.mjs?)', login.data)
token = login.data.accessToken
const coupleId = login.data.userId

const guests = (await api('GET', `/api/v1/guests/couple/${coupleId}`)).data ?? []
const mailable = guests.filter(g => g.mailLine1 && g.mailLine1.trim()).map(g => g.id)
if (mailable.length === 0) fail('no mailable guests seeded')

const before = (await api('GET', `/api/v1/print-orders/couple/${coupleId}`)).data ?? []

const key = `verify-idem-${Date.now()}`
const payload = {
  orderType: 'SAVE_THE_DATE',
  templateKey: 'SAVE_THE_DATE_CLASSIC',
  guestIds: mailable,
  returnName: 'Verify Couple',
  returnAddressLine1: '1 Covenant Way',
  returnCity: 'Franklin',
  returnState: 'TN',
  returnZip: '37064',
  idempotencyKey: key,
}

console.log(`Posting print order twice with idempotencyKey=${key} (${mailable.length} recipients)...`)
const r1 = await api('POST', `/api/v1/print-orders/couple/${coupleId}`, payload)
const r2 = await api('POST', `/api/v1/print-orders/couple/${coupleId}`, payload)

if (!r1.data?.id) fail('first POST did not return an order', r1)
if (!r2.data?.id) fail('second POST did not return an order', r2)

const sameId = r1.data.id === r2.data.id
const after = (await api('GET', `/api/v1/print-orders/couple/${coupleId}`)).data ?? []
const created = after.length - before.length

console.log(`  order #1 id: ${r1.data.id} (status ${r1.data.status})`)
console.log(`  order #2 id: ${r2.data.id} (status ${r2.data.status})`)
console.log(`  orders created by the two POSTs: ${created}`)

if (!sameId) fail('the two POSTs returned DIFFERENT order ids, idempotency not honored')
if (created !== 1) fail(`expected exactly 1 new order row, got ${created}`)

console.log('\n  PASS: identical idempotency key was deduped, one order, returned twice. No double charge.')
