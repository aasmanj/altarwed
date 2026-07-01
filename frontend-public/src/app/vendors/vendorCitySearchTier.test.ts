import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Source-level guard for issue #155 (vendor directory city search drops the
// price-tier filter). vitest runs in a plain node environment here (no jsdom /
// testing-library), matching the other frontend-public tests, so we assert on
// the load-bearing markup of the file the fix touches rather than rendering.
//
// The city search is a GET <form> that reloads /vendors with only the fields it
// submits. Before the fix it re-injected only the `category` hidden input, so a
// prospect who had filtered to a price tier lost it the moment they searched a
// city. The fix mirrors `category` with a `tier` hidden input. Each assertion
// below fails on the pre-fix source and passes after.
function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('Vendor directory city search preserves the price-tier filter (#155)', () => {
  const src = read('app/vendors/page.tsx')

  it('re-injects the active tier as a hidden input on the city search form', () => {
    expect(src).toContain('{tier && <input type="hidden" name="tier" value={tier} />}')
  })

  it('keeps the tier hidden input inside the same GET form as the category one', () => {
    // Both hidden inputs must live between the <form> open tag and its submit
    // button, otherwise the tier value would not be part of the city search
    // request. We locate the city form by its action and assert ordering.
    const formStart = src.indexOf('<form method="GET" action="/vendors"')
    const submitIndex = src.indexOf('<button type="submit"', formStart)
    const categoryInput = src.indexOf('name="category" value={category}', formStart)
    const tierInput = src.indexOf('name="tier" value={tier}', formStart)

    expect(formStart).toBeGreaterThan(-1)
    expect(submitIndex).toBeGreaterThan(formStart)
    expect(categoryInput).toBeGreaterThan(formStart)
    expect(categoryInput).toBeLessThan(submitIndex)
    // The tier hidden input exists and sits inside the form, before submit.
    expect(tierInput).toBeGreaterThan(formStart)
    expect(tierInput).toBeLessThan(submitIndex)
  })
})
