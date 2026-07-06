'use client'

import { useEffect, useState } from 'react'

interface Props {
  defaultName: string
  defaultYear: string
  yearOptions: number[]
}

// Client wrapper for the find-wedding GET search form (issue #297). The form
// still submits as a plain GET navigation (server-rendered results, no fetch),
// but the button now shows a pending state so the click never feels dead
// during the server round trip.
export default function SearchForm({ defaultName, defaultYear, yearOptions }: Props) {
  const [pending, setPending] = useState(false)

  // A GET submit is a full-document navigation, so this component normally
  // unmounts when results arrive. The bfcache back button restores the old
  // page from memory with `pending` still true; pageshow resets it.
  useEffect(() => {
    const reset = () => setPending(false)
    window.addEventListener('pageshow', reset)
    return () => window.removeEventListener('pageshow', reset)
  }, [])

  return (
    <form
      method="GET"
      onSubmit={e => {
        // Guard instead of `disabled` so keyboard focus stays on the button
        // (disabling a focused element drops focus to <body> mid-navigation).
        if (pending) {
          e.preventDefault()
          return
        }
        setPending(true)
      }}
      aria-busy={pending}
      className="flex flex-col sm:flex-row gap-3"
    >
      <input
        type="text"
        name="name"
        defaultValue={defaultName}
        placeholder="Search by name"
        aria-label="Search by name"
        className="flex-1 rounded-xl border border-[#e8dcc8] bg-white px-4 py-3 text-base sm:text-sm text-[#3b2f2f] placeholder-[#8a6a4a] focus:border-[#d4af6a] focus:outline-none"
      />
      <select
        name="year"
        defaultValue={defaultYear}
        aria-label="Wedding year"
        className="rounded-xl border border-[#e8dcc8] bg-white px-4 py-3 text-base sm:text-sm text-[#3b2f2f] focus:border-[#d4af6a] focus:outline-none"
      >
        <option value="">Any year</option>
        {yearOptions.map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      <button
        type="submit"
        aria-disabled={pending}
        className={`rounded-xl bg-[#3b2f2f] px-6 py-3 text-sm font-semibold text-white hover:bg-[#5c4033] transition whitespace-nowrap ${pending ? 'cursor-wait opacity-70' : ''}`}
      >
        {pending ? 'Searching…' : 'Search'}
      </button>
      {/* Always mounted: live regions inserted into the DOM with content already
          present are unreliably announced by NVDA/VoiceOver, so only the text
          toggles. */}
      <span role="status" className="sr-only">{pending ? 'Searching for weddings' : ''}</span>
    </form>
  )
}
