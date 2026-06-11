// Verifies V64: mail_zip widened to NVARCHAR(20) and the US-only CHECK dropped.
// Creates guests with international postal codes through the real API and asserts
// the values persist and round-trip. Run after seed.mjs against a running backend.
import { readFileSync } from 'node:fs'

const cfg = JSON.parse(readFileSync(new URL('./verify.config.json', import.meta.url)))
let failures = 0

function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

const login = await fetch(`${cfg.apiUrl}/api/v1/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: cfg.couple.email, password: cfg.couple.password }),
}).then(r => r.json())
const coupleId = login.coupleId ?? login.userId
const auth = { Authorization: `Bearer ${login.accessToken}`, 'Content-Type': 'application/json' }

async function createGuest(body) {
  const res = await fetch(`${cfg.apiUrl}/api/v1/guests/couple/${coupleId}`, {
    method: 'POST', headers: auth, body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

// 1. Canonical international guest: 7-char Canadian postal code.
//    Under the old chk_guests_mail_zip CHECK this exact value was rejected (non-US format).
const ca = await createGuest({
  name: 'Verify Canadian Guest', plusOneAllowed: false,
  mailLine1: '123 Maple St', mailCity: 'Medicine Hat', mailState: 'Alberta',
  mailZip: 'T1A 0W3', mailCountry: 'Canada',
})
check('POST guest with mailZip "T1A 0W3" / Canada returns 2xx', ca.status >= 200 && ca.status < 300, `status=${ca.status} body=${JSON.stringify(ca.body)}`)
check('created guest echoes mailZip "T1A 0W3"', ca.body?.mailZip === 'T1A 0W3', `mailZip=${JSON.stringify(ca.body?.mailZip)}`)

// 2. The exact prod failure value: 14 chars, exceeds the old NVARCHAR(10).
const messy = await createGuest({
  name: 'Verify Messy Zip Guest', plusOneAllowed: false,
  mailLine1: '456 Oak Ave', mailCity: 'Medicine Hat', mailZip: 'Canada T1A 0W3',
})
check('POST guest with 14-char mailZip "Canada T1A 0W3" returns 2xx', messy.status >= 200 && messy.status < 300, `status=${messy.status} body=${JSON.stringify(messy.body)}`)
check('created guest echoes the full 14-char zip', messy.body?.mailZip === 'Canada T1A 0W3', `mailZip=${JSON.stringify(messy.body?.mailZip)}`)

// 3. Round-trip: GET the list and confirm both values came back from the DB, not the echo.
const list = await fetch(`${cfg.apiUrl}/api/v1/guests/couple/${coupleId}`, { headers: auth }).then(r => r.json())
const guests = Array.isArray(list) ? list : list.content ?? []
const caRow = guests.find(g => g.name === 'Verify Canadian Guest')
const messyRow = guests.find(g => g.name === 'Verify Messy Zip Guest')
check('GET round-trip: Canadian guest persisted with zip + country', caRow?.mailZip === 'T1A 0W3' && caRow?.mailCountry === 'Canada', JSON.stringify({ mailZip: caRow?.mailZip, mailCountry: caRow?.mailCountry }))
check('GET round-trip: 14-char zip persisted intact', messyRow?.mailZip === 'Canada T1A 0W3', JSON.stringify({ mailZip: messyRow?.mailZip }))

// 4. Probe: >20 chars must be a clean 400 from DTO validation, never a 500 from SQL.
const oversized = await createGuest({
  name: 'Verify Oversized Zip Guest', plusOneAllowed: false,
  mailZip: 'X'.repeat(25),
})
check('🔍 POST guest with 25-char mailZip returns 400 (not 500)', oversized.status === 400, `status=${oversized.status} body=${JSON.stringify(oversized.body)}`)

process.exit(failures === 0 ? 0 : 1)
