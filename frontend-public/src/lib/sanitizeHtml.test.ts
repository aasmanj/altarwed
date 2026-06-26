import { describe, it, expect } from 'vitest'
import { sanitizePostContent } from './sanitizeHtml'

describe('sanitizePostContent', () => {
  it('strips <script> tags and their contents', () => {
    const out = sanitizePostContent('<p>Hello</p><script>alert(1)</script>')
    expect(out).not.toContain('<script')
    expect(out).not.toContain('alert(1)')
    expect(out).toContain('<p>Hello</p>')
  })

  it('strips the onerror attribute from <img> but keeps src', () => {
    const out = sanitizePostContent('<img onerror="alert(1)" src="x">')
    expect(out).not.toContain('onerror')
    expect(out).toContain('<img')
    expect(out).toContain('src="x"')
  })

  it('keeps safe formatting tags: h2, p, a[href], strong', () => {
    const input =
      '<h2>Title</h2><p>Body <strong>bold</strong> and <a href="https://example.com">link</a></p>'
    const out = sanitizePostContent(input)
    expect(out).toContain('<h2>Title</h2>')
    expect(out).toContain('<strong>bold</strong>')
    expect(out).toContain('href="https://example.com"')
    expect(out).toContain('<a')
  })

  it('strips javascript: hrefs while keeping the anchor text', () => {
    const out = sanitizePostContent('<a href="javascript:alert(1)">click</a>')
    expect(out).not.toContain('javascript:')
    expect(out).toContain('click')
  })

  it('leaves valid blog HTML unchanged so SSR/SSG output is identical', () => {
    const valid =
      '<h2>Section</h2><p>A paragraph with <em>emphasis</em> and <strong>strength</strong>.</p>' +
      '<ul><li>One</li><li>Two</li></ul><blockquote>Quote</blockquote>'
    expect(sanitizePostContent(valid)).toBe(valid)
  })
})
