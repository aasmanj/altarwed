import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Source-level guards for the Pinterest viral loop (issue #374). vitest runs here in
// a plain node environment (no jsdom / testing-library), matching the other wedding
// tests, so rather than render the tree we assert on the load-bearing markup:
//   - the wedding layout emits rich-pin-compatible Open Graph (og:type=article +
//     site_name + author) so a pinned wedding page becomes an Article rich pin, and
//   - it renders the Pinterest "Save" control wired to the couple's hero image, and
//   - the control builds a valid pinterest.com/pin/create URL with encoded params.
// Before this change the layout only had og:type=website and no share control, so
// these assertions fail on the pre-#374 source and pass after it.
function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('Pinterest rich-pin meta on /wedding/[slug] (issue #374)', () => {
  const layout = read('app/wedding/[slug]/layout.tsx')

  it('marks the wedding Open Graph as an Article rich pin', () => {
    // og:type must be 'article' (not 'website') for Pinterest to render the
    // author/site_name rich-pin fields under the pin.
    expect(layout).toContain("type: 'article'")
    expect(layout).not.toContain("type: 'website'")
  })

  it('supplies the site name and couple author for the rich pin', () => {
    expect(layout).toContain("siteName: 'AltarWed'")
    expect(layout).toContain('authors: [coupleNames]')
  })

  it('keeps the couple hero as the pinned og:image', () => {
    // The hero (or the self-hosted fallback) remains the share/pin image.
    expect(layout).toContain('images: [{ url: image, width: 1200, height: 800, alt: title }]')
  })
})

describe('Pinterest share control on /wedding/[slug] (issue #374)', () => {
  const layout = read('app/wedding/[slug]/layout.tsx')
  const button = read('app/wedding/[slug]/PinterestShareButton.tsx')

  it('renders the share control in the layout wired to the hero image', () => {
    expect(layout).toContain('import PinterestShareButton from')
    expect(layout).toContain('<PinterestShareButton')
    // media = the absolute hero URL the layout already derives for schema.org.
    expect(layout).toContain('media={heroImageAbsolute}')
    expect(layout).toContain('url={`https://www.altarwed.com/wedding/${slug}`}')
  })

  it('builds a valid, param-encoded Pinterest pin-create URL', () => {
    expect(button).toContain('https://www.pinterest.com/pin/create/button/')
    expect(button).toContain('url=${encodeURIComponent(url)}')
    expect(button).toContain('media=${encodeURIComponent(media)}')
    expect(button).toContain('description=${encodeURIComponent(description)}')
  })

  it('is an accessible link: labelled, focus-visible, and tabnabbing-safe', () => {
    expect(button).toContain('Save to Pinterest')
    expect(button).toContain('rel="noopener noreferrer"')
    expect(button).toContain('focus-visible:ring')
    // The Pinterest logo SVG is decorative next to the visible text label.
    expect(button).toContain('aria-hidden="true"')
  })
})
