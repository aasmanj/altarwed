import sanitizeHtml from 'sanitize-html'

// Blog post bodies are stored as raw HTML in the database and rendered with
// dangerouslySetInnerHTML on the public apex domain. Any attacker-influenced or
// compromised row would otherwise become persistent XSS that runs for every
// visitor and crawler. We sanitize server-side with a strict allowlist so the
// SSR/SSG output is unchanged for legitimate formatting but cannot carry
// scripts, event handlers, or dangerous URL schemes.
//
// The allowlist is intentionally limited to the tags the `prose` Tailwind
// styles in blog/[slug]/page.tsx actually target. Do not widen it without a
// matching prose style; a wider allowlist is a wider attack surface.
const ALLOWED_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'p',
  'a',
  'strong',
  'em',
  'ul',
  'ol',
  'li',
  'blockquote',
  'code',
  'pre',
  'img',
  'br',
  'hr',
]

/**
 * Sanitize DB-sourced blog HTML against a formatting-only allowlist.
 *
 * Runs in pure Node (sanitize-html), so it stays inside the server component and
 * never ships to the client. Disallowed tags (e.g. <script>) and their text are
 * dropped, and any attribute not on the per-tag allowlist (e.g. onerror) is
 * stripped while the safe formatting tags survive.
 */
export function sanitizePostContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'width', 'height'],
    },
    // Only safe link/image URL schemes. This blocks javascript: and data: URLs.
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    // Drop the inner text of disallowed tags like <script>/<style> rather than
    // leaking it back into the document as plain text.
    disallowedTagsMode: 'discard',
    nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript'],
  })
}
