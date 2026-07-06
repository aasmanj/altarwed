import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import path from 'path'

// Source-level guard for issue #297 (frontend-public had zero route loading
// states, so vendor-directory and blog clicks felt dead for the full server
// round trip). vitest runs in a plain node environment here (no jsdom), so we
// assert on the load-bearing markup of the files the fix adds.
//
// Before the fix: `src/app/**/loading.tsx` matched nothing anywhere, and the
// find-wedding GET form submitted with a button that never showed pending.
// After the fix: /vendors, /vendors/[id], /find-wedding, and /blog each have a
// route-level loading.tsx built from one shared skeleton component
// (motion-safe shimmer, static under motion-reduce, aria-busy container), and
// the find-wedding Search button flips to a pending state on submit.

function srcPath(rel: string): string {
  return path.join(process.cwd(), 'src', rel)
}

function read(rel: string): string {
  return readFileSync(srcPath(rel), 'utf8')
}

const LOADING_ROUTES = [
  'app/vendors/loading.tsx',
  'app/vendors/[id]/loading.tsx',
  'app/find-wedding/loading.tsx',
  'app/blog/loading.tsx',
]

describe('route-level loading skeletons exist and share one component (#297)', () => {
  it('every affected route has a loading.tsx', () => {
    for (const rel of LOADING_ROUTES) {
      expect(existsSync(srcPath(rel)), `${rel} should exist`).toBe(true)
    }
  })

  it('each loading.tsx uses the shared Skeleton primitives, not bespoke markup', () => {
    for (const rel of LOADING_ROUTES) {
      const src = read(rel)
      expect(src, `${rel} should import the shared skeleton`)
        .toContain("from '@/components/Skeleton'")
      expect(src, `${rel} should render SkeletonRegion`).toContain('<SkeletonRegion')
      expect(src, `${rel} should render Skeleton blocks`).toContain('<Skeleton ')
    }
  })

  it('the vendors skeleton reserves the card grid so content lands without a jump', () => {
    const src = read('app/vendors/loading.tsx')
    expect(src).toContain('grid sm:grid-cols-2 lg:grid-cols-3 gap-5')
    expect(src).toContain('rounded-2xl border border-[#e8dcc8] bg-white p-6')
  })

  it('the blog skeleton reserves the article card shape', () => {
    const src = read('app/blog/loading.tsx')
    expect(src).toContain('grid sm:grid-cols-2 gap-8')
    expect(src).toContain('h-48 w-full')
  })
})

describe('shared Skeleton component a11y and motion behavior (#297)', () => {
  const src = read('components/Skeleton.tsx')

  it('shimmers only under motion-safe and stays static under motion-reduce', () => {
    expect(src).toContain('motion-safe:animate-pulse')
    expect(src).toContain('motion-reduce:animate-none')
  })

  it('marks the loading region aria-busy with a screen-reader-only status', () => {
    expect(src).toContain('aria-busy="true"')
    expect(src).toContain('role="status"')
    expect(src).toContain('sr-only')
  })

  it('hides individual skeleton blocks from assistive tech (no fake data read aloud)', () => {
    expect(src).toContain('aria-hidden="true"')
  })
})

describe('find-wedding Search button shows a pending state on submit (#297)', () => {
  const page = read('app/find-wedding/page.tsx')
  const form = read('app/find-wedding/SearchForm.tsx')

  it('the page renders the client SearchForm instead of a bare GET form', () => {
    expect(page).toContain("import SearchForm from './SearchForm'")
    expect(page).toContain('<SearchForm')
    expect(page).not.toContain('<form method="GET"')
  })

  it('the form is a client component that still submits as a plain GET', () => {
    expect(form).toContain("'use client'")
    expect(form).toContain('method="GET"')
  })

  it('submit flips a pending flag that guards re-submit and swaps the label', () => {
    expect(form).toContain('setPending(true)')
    expect(form).toContain("{pending ? 'Searching…' : 'Search'}")
    expect(form).toContain('aria-busy={pending}')
    // Re-submit is blocked by an early-return guard, not `disabled`, so
    // keyboard focus is never dropped from the focused button.
    expect(form).toContain('e.preventDefault()')
    expect(form).toContain('aria-disabled={pending}')
    // Whitespace-anchored so it rejects the bare attribute without matching
    // the `aria-disabled` occurrence above.
    expect(form).not.toMatch(/\sdisabled=\{pending\}/)
  })

  it('announces the pending search via an always-mounted live region', () => {
    // The span must stay mounted with only its text toggling: live regions
    // inserted into the DOM with content already present are unreliably
    // announced by NVDA/VoiceOver.
    expect(form).toContain(
      '<span role="status" className="sr-only">{pending ? \'Searching for weddings\' : \'\'}</span>'
    )
    expect(form).not.toContain('{pending && (')
  })

  it('resets pending on bfcache restore so the back button never strands a disabled form', () => {
    expect(form).toContain("window.addEventListener('pageshow', reset)")
  })
})
