import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Issue #237: the published-site banner on the dashboard had a "Share" link
// whose href pointed at /dashboard/website/editor, so a couple wanting to
// re-share their live site (the core viral act) got dumped in the editor
// instead of the ShareModal. The fix converts that link into a real button
// that opens the existing ShareModal directly with the site URL.
//
// frontend-app's vitest runs in a node environment (no jsdom / testing-library),
// so the behavioral contract is verified with source-level assertions that:
//   1. the banner Share control is a button wired to open the modal;
//   2. the editor route is no longer reachable from the published banner;
//   3. the ShareModal is mounted with the live slug + couple names;
//   4. the per-channel share_clicked analytics path is untouched (the modal
//      still owns trackShareClicked, so the new caller cannot bypass it).

// Built from a char code so this file itself contains no literal em dash.
const EM_DASH = String.fromCharCode(0x2014)

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('dashboard Share opens ShareModal (issue #237)', () => {
  const cardSrc = read('features/couple/AtAGlanceCard.tsx')

  it('mounts ShareModal from the dashboard card with the live slug and couple names', () => {
    expect(cardSrc).toContain("import ShareModal from '@/features/couple/website/ShareModal'")
    expect(cardSrc).toContain('<ShareModal')
    expect(cardSrc).toContain('slug={website.slug}')
    expect(cardSrc).toContain('coupleNames={`${website.partnerOneName} & ${website.partnerTwoName}`}')
  })

  it('renders the published-banner Share as a button that opens the modal, not a link', () => {
    expect(cardSrc).toContain('onClick={() => setShareOpen(true)}')
    expect(cardSrc).toContain('aria-label="Share wedding website"')
    // Accessibility: any focus:outline-none must be paired with a focus-visible ring.
    expect(cardSrc).toContain('focus-visible:ring-green-400')
  })

  it('no longer routes the published banner Share control into the editor', () => {
    // The only remaining reference to the editor route is the draft banner's
    // Publish action; the published banner's Share must not link there anymore.
    const editorHrefs = cardSrc.match(/\/dashboard\/website\/editor/g) ?? []
    expect(editorHrefs.length).toBe(1)
  })

  it('keeps the per-channel share_clicked analytics inside the reused ShareModal', () => {
    // The new call path reuses ShareModal as-is, so the analytics stay owned by
    // the modal. Guard against a future refactor that strips them out.
    const modalSrc = read('features/couple/website/ShareModal.tsx')
    expect(modalSrc).toContain("import { trackShareClicked } from './shareAnalytics'")
    expect(modalSrc).toContain("trackShareClicked('facebook')")
    expect(modalSrc).toContain("trackShareClicked('sms')")
    expect(modalSrc).toContain("trackShareClicked('copy_link')")
    expect(modalSrc).toContain("trackShareClicked('native')")
  })

  it('is em-dash free', () => {
    expect(cardSrc).not.toContain(EM_DASH)
  })
})
