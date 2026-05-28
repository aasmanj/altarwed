'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Props {
  slug: string
  hasStory: boolean
  hasDetails: boolean
  hasParty: boolean
  hasRegistry: boolean
  hasTravel: boolean
  // V34: tabs the couple opted to hide entirely from public navigation.
  // Set elements are BlockTab enum names; we map nav entries to those names
  // and filter against this set. Empty set / undefined = honour content gates only.
  hiddenTabs?: Set<string>
  // V34: per-tab custom label overrides (e.g. TRAVEL → "Hotels & flights").
  // Missing keys fall back to the default label.
  customLabels?: Partial<Record<string, string>>
}

export default function WeddingNav({
  slug, hasStory, hasDetails, hasParty, hasRegistry, hasTravel,
  hiddenTabs, customLabels,
}: Props) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const base = `/wedding/${slug}`
  const label = (tab: string, fallback: string) => customLabels?.[tab] || fallback
  // HOME and RSVP are load-bearing navigation anchors that the rest of the site
  // links to. Even if a malformed hiddenTabs value or a future API call manages
  // to include one of them, this guard ensures guests can still navigate Home
  // and submit an RSVP. The editor TabSettingsPanel also disables these
  // checkboxes UI-side; this is defence in depth.
  const HARD_VISIBLE: ReadonlySet<string> = new Set(['HOME', 'RSVP'])
  const visible = (tab: string) => HARD_VISIBLE.has(tab) || !hiddenTabs?.has(tab)

  // Each entry pairs a BlockTab enum name with its nav metadata. `show` combines
  // the data-gate (does the couple have content for this tab?) AND the per-couple
  // visibility override (did they explicitly hide it?). Hidden wins: couples
  // intentionally opting out of a tab is a stronger signal than the default
  // content-gate heuristic.
  const tabs = [
    { tab: 'HOME',          label: label('HOME',          'Home'),          href: base,                    show: visible('HOME') },
    { tab: 'OUR_STORY',     label: label('OUR_STORY',     'Our Story'),     href: `${base}/story`,         show: hasStory       && visible('OUR_STORY') },
    { tab: 'DETAILS',       label: label('DETAILS',       'The Wedding'),   href: `${base}/details`,       show: hasDetails     && visible('DETAILS') },
    { tab: 'WEDDING_PARTY', label: label('WEDDING_PARTY', 'Wedding Party'), href: `${base}/wedding-party`, show: hasParty       && visible('WEDDING_PARTY') },
    { tab: 'TRAVEL',        label: label('TRAVEL',        'Travel'),        href: `${base}/travel`,        show: hasTravel      && visible('TRAVEL') },
    { tab: 'REGISTRY',      label: label('REGISTRY',      'Registry'),      href: `${base}/registry`,      show: hasRegistry    && visible('REGISTRY') },
    { tab: 'PHOTOS',        label: label('PHOTOS',        'Photos'),        href: `${base}/photos`,        show: visible('PHOTOS') },
    { tab: 'RSVP',          label: label('RSVP',          'RSVP'),          href: `${base}/rsvp`,          show: visible('RSVP') },
  ].filter(t => t.show)

  function isActive(href: string) {
    if (href === base) return pathname === base
    return pathname.startsWith(href)
  }

  // Below 640px (Tailwind `sm`) the nav becomes horizontally scrollable so
  // couples with many tabs and/or long custom labels do not lose tabs to
  // text-ellipsis. At sm+ we keep the equal-width flex layout because the
  // viewport has room for all 8 tabs at standard widths.
  return (
    <div className={`sticky top-0 z-40 bg-[#fdfaf6] border-b border-[#e8dcc8] transition-shadow duration-200 ${
      scrolled ? 'shadow-sm' : ''
    }`}>
      <nav
        aria-label="Wedding sections"
        className="max-w-3xl mx-auto flex overflow-x-auto sm:overflow-visible scrollbar-none"
      >
        {tabs.map(tab => {
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 sm:flex-1 text-center px-4 sm:px-1 py-4 text-xs font-medium border-b-2 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af6a] focus-visible:ring-inset ${
                active
                  ? 'border-[#d4af6a] text-[#3b2f2f]'
                  : 'border-transparent text-[#a08060] hover:text-[#3b2f2f]'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
