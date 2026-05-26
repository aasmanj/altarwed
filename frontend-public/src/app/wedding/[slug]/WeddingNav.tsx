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
  const visible = (tab: string) => !hiddenTabs?.has(tab)

  // Each entry pairs a BlockTab enum name with its nav metadata. `show` combines
  // the data-gate (does the couple have content for this tab?) AND the per-couple
  // visibility override (did they explicitly hide it?). Hidden wins — couples
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

  return (
    <div className={`sticky top-0 z-40 bg-[#fdfaf6] border-b border-[#e8dcc8] transition-shadow duration-200 ${
      scrolled ? 'shadow-sm' : ''
    }`}>
      <nav className="max-w-3xl mx-auto flex">
        {tabs.map(tab => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 text-center px-1 py-4 text-xs font-medium border-b-2 transition-colors whitespace-nowrap overflow-hidden text-ellipsis ${
              isActive(tab.href)
                ? 'border-[#d4af6a] text-[#3b2f2f]'
                : 'border-transparent text-[#a08060] hover:text-[#3b2f2f]'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
