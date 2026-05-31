// Seeds a known test couple + wedding into the running verify backend, via the
// real REST API (so it exercises the same code paths a user would).
//
// Run AFTER the backend is up (./gradlew bootTestRun):
//   node verify/seed.mjs
//
// Idempotent: if the test couple already exists, it logs in, reports the existing
// state, and skips creation, so re-running never duplicates rows. Node 20+ only
// (uses global fetch).

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
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { status: res.status, ok: res.ok, data }
}

function die(msg, detail) {
  console.error(`\n  SEED FAILED: ${msg}`)
  if (detail !== undefined) console.error('  detail:', JSON.stringify(detail))
  process.exit(1)
}

async function main() {
  console.log(`Seeding verify data against ${API} ...`)

  // 1. Register the test couple. 409 => already exists, switch to login + skip.
  const reg = await api('POST', '/api/v1/couples/register', {
    partnerOneName: cfg.couple.partnerOneName,
    partnerTwoName: cfg.couple.partnerTwoName,
    email: cfg.couple.email,
    password: cfg.couple.password,
    weddingDate: '2026-09-19',
  })

  let coupleId
  let freshCouple = true
  if (reg.status === 201) {
    token = reg.data.accessToken
    coupleId = reg.data.userId
    console.log(`  registered new couple, coupleId=${coupleId}`)
  } else if (reg.status === 409) {
    freshCouple = false
    const login = await api('POST', '/api/v1/auth/login', {
      email: cfg.couple.email,
      password: cfg.couple.password,
    })
    if (!login.ok) die('test couple exists but login failed', login.data)
    token = login.data.accessToken
    coupleId = login.data.userId
    console.log(`  test couple already exists, coupleId=${coupleId} (skipping content creation)`)
  } else {
    die(`unexpected register status ${reg.status}`, reg.data)
  }

  if (!freshCouple) {
    console.log('\n  Already seeded. Nothing to do. Test couple is ready:')
    printSummary(coupleId)
    return
  }

  // 2. Wedding website.
  const create = await api('POST', `/api/v1/wedding-websites/couple/${coupleId}`, {
    slug: cfg.slug,
    partnerOneName: cfg.couple.partnerOneName,
    partnerTwoName: cfg.couple.partnerTwoName,
    weddingDate: '2026-09-19',
  })
  if (!create.ok && create.status !== 409) die('create website failed', create.data)
  const website = create.ok ? create.data : (await api('GET', `/api/v1/wedding-websites/couple/${coupleId}`)).data
  const websiteId = website.id
  console.log(`  website created, slug=${cfg.slug}, websiteId=${websiteId}`)

  // 3. Fill venue + hotel + scripture, leave registry EMPTY on purpose so the
  //    preview-placeholder change is observable (registry card shows a
  //    placeholder in the editor preview but nothing on the live page).
  const patch = await api('PATCH', `/api/v1/wedding-websites/couple/${coupleId}`, {
    heroTagline: 'Two families, one covenant',
    ourStory: 'We met at a young-adults Bible study and never looked back.',
    scriptureReference: 'Colossians 3:14',
    scriptureText: 'And over all these virtues put on love, which binds them all together in perfect unity.',
    venueName: 'Grace Chapel',
    venueAddress: '100 Covenant Way',
    venueCity: 'Franklin',
    venueState: 'TN',
    ceremonyTime: '4:00 PM',
    dressCode: 'Garden formal',
    hotelName: 'The Harpeth Hotel',
    hotelUrl: 'https://example.com/harpeth',
    hotelDetails: 'Ask for the wedding block rate.',
    registryUrl1: '',
    registryLabel1: '',
  })
  if (!patch.ok) die('update website failed', patch.data)
  console.log('  website details filled (venue + hotel set, registry intentionally empty)')

  // 4. Publish so the public page and preview render.
  const pub = await api('POST', `/api/v1/wedding-websites/couple/${coupleId}/publish`)
  if (!pub.ok) die('publish failed', pub.data)
  console.log('  website published')

  // 5. Blocks. VENUE_CARD on DETAILS renders the real venue; REGISTRY_CARD on
  //    REGISTRY has no registry data, so it shows the new preview placeholder.
  const blocks = [
    { tab: 'DETAILS',  type: 'HEADING',       contentJson: JSON.stringify({ text: 'Event Details', level: 2 }) },
    { tab: 'DETAILS',  type: 'VENUE_CARD',    contentJson: '{}' },
    { tab: 'REGISTRY', type: 'HEADING',       contentJson: JSON.stringify({ text: 'Our Registry', level: 2 }) },
    { tab: 'REGISTRY', type: 'REGISTRY_CARD', contentJson: JSON.stringify({ slot: 1 }) },
  ]
  for (const b of blocks) {
    const r = await api('POST', `/api/v1/wedding-page-blocks/website/${websiteId}`, b)
    if (!r.ok) die(`create block ${b.type} failed`, r.data)
  }
  console.log(`  ${blocks.length} blocks created (incl. empty registry card for the placeholder check)`)

  // 6. Guests. Mix of email + mailing address so save-the-dates, RSVP invites,
  //    and the print/communications flows all have data to act on.
  const guests = [
    { name: 'Andrew Carter',  email: 'andrew@guest.test',  side: 'GROOM', mailLine1: '1 Oak St',   mailCity: 'Franklin', mailState: 'TN', mailZip: '37064' },
    { name: 'Bethany Cole',   email: 'bethany@guest.test', side: 'BRIDE', mailLine1: '2 Elm Ave',  mailCity: 'Nashville', mailState: 'TN', mailZip: '37201' },
    { name: 'Caleb Dawson',   email: 'caleb@guest.test',   side: 'GROOM', mailLine1: '3 Pine Rd',  mailCity: 'Brentwood', mailState: 'TN', mailZip: '37027' },
    { name: 'Diana Ellis',    email: 'diana@guest.test',   side: 'BRIDE' },
    { name: 'Aaron Abbott',   email: 'aaron@guest.test',   side: 'BOTH',  mailLine1: '5 Cedar Ln', mailCity: 'Franklin', mailState: 'TN', mailZip: '37064' },
  ]
  const guestIds = []
  for (const g of guests) {
    const r = await api('POST', `/api/v1/guests/couple/${coupleId}`, { plusOneAllowed: false, ...g })
    if (!r.ok) die(`create guest ${g.name} failed`, r.data)
    guestIds.push(r.data.id)
  }
  console.log(`  ${guests.length} guests created`)

  // 7. Seating tables + assignments, so the printable board has content.
  const tableNames = ['Family Table', 'College Friends']
  for (const name of tableNames) {
    const r = await api('POST', `/api/v1/seating-tables/couple/${coupleId}`, { name, capacity: 8 })
    if (!r.ok) die(`create table ${name} failed`, r.data)
  }
  // tableNumber is 1-based by creation order. Seat 4 of 5 guests, leave 1 unassigned.
  const assignments = [
    [guestIds[0], 1], [guestIds[4], 1],
    [guestIds[1], 2], [guestIds[2], 2],
  ]
  for (const [guestId, tableNumber] of assignments) {
    const r = await api('PUT', `/api/v1/guests/couple/${coupleId}/${guestId}/table`, { tableNumber })
    if (!r.ok) die(`assign guest ${guestId} to table ${tableNumber} failed`, r.data)
  }
  console.log(`  ${tableNames.length} tables created, ${assignments.length} guests seated (1 left unassigned)`)

  console.log('\n  Seed complete. Test couple is ready:')
  printSummary(coupleId)
}

function printSummary(coupleId) {
  console.log(`    login:    ${cfg.couple.email} / ${cfg.couple.password}`)
  console.log(`    coupleId: ${coupleId}`)
  console.log(`    SPA:      ${cfg.appUrl}/login`)
  console.log(`    public:   ${cfg.publicUrl}/wedding/${cfg.slug}`)
  console.log(`    preview:  ${cfg.publicUrl}/preview/${cfg.slug}/registry  (empty registry card -> placeholder)`)
}

main().catch(e => die('unexpected error', e?.message ?? String(e)))
