// Forces Facebook to RE-SCRAPE the Open Graph tags for every URL in the sitemap.
// Facebook caches OG data for ~30 days, so after you change share-card tags you
// must tell it to re-fetch, otherwise old previews keep showing.
//
// SETUP (one time):
//   1. Create a Facebook App at https://developers.facebook.com/apps (type:
//      "Business" is fine; you do not need to submit it for review, the app
//      access token works for the scrape endpoint immediately).
//   2. Copy the App ID and App Secret (Settings -> Basic).
//
// RUN:
//   FB_APP_ID=xxx FB_APP_SECRET=yyy node scripts/refresh-facebook-og.mjs
//   # or, if you already have the combined app token:
//   FB_APP_TOKEN="appid|appsecret" node scripts/refresh-facebook-og.mjs
//   # override the sitemap if needed:
//   SITEMAP_URL=https://www.altarwed.com/sitemap.xml node scripts/refresh-facebook-og.mjs
//
// MANUAL alternative for a handful of URLs (no app needed, just your FB login):
//   https://developers.facebook.com/tools/debug/  -> paste URL -> "Scrape Again"
//
// Node 20+ (global fetch). Read-only against your own site + FB's Graph API; it
// does not change any AltarWed data.

const SITEMAP = process.env.SITEMAP_URL ?? 'https://www.altarwed.com/sitemap.xml'
const token =
  process.env.FB_APP_TOKEN ??
  (process.env.FB_APP_ID && process.env.FB_APP_SECRET
    ? `${process.env.FB_APP_ID}|${process.env.FB_APP_SECRET}`
    : null)

if (!token) {
  console.error('Missing credentials. Set FB_APP_TOKEN, or FB_APP_ID + FB_APP_SECRET. See the header of this file.')
  process.exit(1)
}

const xml = await (await fetch(SITEMAP)).text()
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim())
if (urls.length === 0) {
  console.error(`No <loc> URLs found in ${SITEMAP}`)
  process.exit(1)
}
console.log(`Found ${urls.length} URLs in ${SITEMAP}. Re-scraping via Graph API...\n`)

let ok = 0, fail = 0
for (const url of urls) {
  try {
    const res = await fetch(
      `https://graph.facebook.com/?id=${encodeURIComponent(url)}&scrape=true&access_token=${encodeURIComponent(token)}`,
      { method: 'POST' },
    )
    const data = await res.json().catch(() => ({}))
    if (res.ok && !data.error) {
      ok++
      // data.title is what FB now sees, handy to eyeball that the new tags landed.
      console.log(`  ok   ${url}  ->  ${data.title ?? '(scraped)'}`)
    } else {
      fail++
      console.log(`  FAIL ${url}  ->  ${data.error?.message ?? res.status}`)
    }
  } catch (e) {
    fail++
    console.log(`  FAIL ${url}  ->  ${e.message}`)
  }
  await new Promise(r => setTimeout(r, 250)) // gentle, FB rate-limits the scrape endpoint
}

console.log(`\nDone. ${ok} re-scraped, ${fail} failed.`)
if (fail > 0) process.exit(1)
