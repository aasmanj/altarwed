import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Issue #310: the preview side of the tab-switch contract. frontend-public's
// vitest runs in a node environment (no jsdom / testing-library), so the
// component wiring is verified with source-level assertions, mirroring the
// approach used across this workspace's other component tests (e.g.
// rsvpMobileUx.test.ts).

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('TabSwitchListener (issue #310)', () => {
  const src = read('app/preview/[slug]/[tab]/TabSwitchListener.tsx')

  it('checks the message origin against the editor whitelist before acting', () => {
    expect(src).toContain('EDITOR_ORIGINS.includes(e.origin)')
  })

  it('acks the tab-switch straight back to the verified sender origin, never a wildcard', () => {
    expect(src).toContain('makeTabSwitchAckMessage(requestedTab), e.origin')
    expect(src).not.toContain("postMessage(makeTabSwitchAckMessage(requestedTab), '*')")
  })

  it('navigates with Next\'s router instead of a full document reload', () => {
    expect(src).toContain("import { useRouter } from 'next/navigation'")
    expect(src).toContain('router.push(`/preview/${slug}/${requestedTab.toLowerCase()}`)')
  })

  it('announces preview-tab-ready once mounted for the tab, not to a wildcard origin', () => {
    expect(src).toContain('makePreviewTabReadyMessage(tab)')
    expect(src).not.toContain("postMessage(makePreviewTabReadyMessage(tab), '*')")
  })
})

describe('BlockListLive stays tab-scoped and origin-checked (issue #310)', () => {
  const src = read('app/preview/[slug]/[tab]/BlockListLive.tsx')

  it('checks the message origin against the editor whitelist (previously missing)', () => {
    expect(src).toContain('EDITOR_ORIGINS.includes(e.origin)')
  })

  it('only applies a blocks-update tagged for the currently rendered tab', () => {
    expect(src).toContain('parseBlocksUpdate(e.data, tab)')
  })
})

describe('preview page wires the tab-switch listener alongside the existing live channel (issue #310)', () => {
  const src = read('app/preview/[slug]/[tab]/page.tsx')

  it('mounts TabSwitchListener with the current slug and tab', () => {
    expect(src).toContain("import TabSwitchListener from './TabSwitchListener'")
    expect(src).toContain('<TabSwitchListener slug={slug} tab={currentTab} />')
  })

  it('still passes tab to BlockListLive so the existing live-update channel is unchanged in behavior', () => {
    expect(src).toContain('<BlockListLive')
    expect(src).toContain('tab={currentTab}')
  })
})
