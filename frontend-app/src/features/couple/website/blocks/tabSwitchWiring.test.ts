import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Issue #310: every editor tab click remounted the whole preview iframe (white
// flash + a full SSR round trip) because the tab button's onClick still called
// bumpPreview() even after switchPreviewTab/previewChannel.ts were added to
// send a postMessage instead. This is the missing wire-up.
//
// frontend-app's vitest runs in a node environment (no jsdom / testing-library),
// so the click wiring is verified with a source-level assertion on the tab
// button's onClick body, mirroring heroFocalPointPreview.test.ts.

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('SideBySideEditor tab click no longer remounts the preview (issue #310)', () => {
  const src = read('features/couple/website/blocks/SideBySideEditor.tsx')

  it('the tab bar onClick switches the preview tab over postMessage, not bumpPreview', () => {
    const match = src.match(/key=\{t\}\s*onClick=\{\(\) => \{([\s\S]*?)\n\s*\}\}/)
    expect(match, 'expected to find the BLOCK_TABS.map tab button onClick handler').not.toBeNull()
    const body = match![1]
    expect(body).toContain('setActiveTab(t)')
    // This assertion fails on the pre-fix source (it called bumpPreview()).
    expect(body).toContain('switchPreviewTab(t)')
    expect(body).not.toContain('bumpPreview()')
  })

  it('switchPreviewTab posts a tab-switch message and arms the reload fallback', () => {
    const match = src.match(/const switchPreviewTab = useCallback\(\(tab: BlockTab\) => \{([\s\S]*?)\n {2}\}, \[reloadPreview\]\)/)
    expect(match, 'expected to find switchPreviewTab').not.toBeNull()
    const body = match![1]
    expect(body).toContain('makeTabSwitchMessage(tab)')
    expect(body).toContain('TAB_SWITCH_ACK_TIMEOUT_MS')
    expect(body).toContain('reloadPreview(tab)')
  })

  it('bumpPreview still reloads the iframe for publish (template/reload paths untouched)', () => {
    const match = src.match(/const togglePublish = \(\) => \{([\s\S]*?)\n {2}\}/)
    expect(match, 'expected to find togglePublish').not.toBeNull()
    expect(match![1]).toContain('bumpPreview()')
  })

  it('the iframe src is decoupled from activeTab (iframeTab), so a tab click cannot force a document navigation', () => {
    expect(src).toContain('src={previewUrl(website.slug, iframeTab)}')
    expect(src).not.toContain('src={previewUrl(website.slug, activeTab)}')
  })
})
