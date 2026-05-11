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
}

export default function WeddingNav({ slug, hasStory, hasDetails, hasParty, hasRegistry, hasTravel }: Props) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const base = `/wedding/${slug}`

  const tabs = [
    { label: 'Home',          href: base,                    show: true },
    { label: 'Our Story',     href: `${base}/story`,         show: hasStory },
    { label: 'The Wedding',   href: `${base}/details`,       show: hasDetails },
    { label: 'Wedding Party', href: `${base}/wedding-party`, show: hasParty },
    { label: 'Travel',        href: `${base}/travel`,        show: hasTravel },
    { label: 'Registry',      href: `${base}/registry`,      show: hasRegistry },
    { label: 'Photos',        href: `${base}/photos`,        show: true },
    { label: 'Prayers',       href: `${base}/prayers`,       show: true },
  ].filter(t => t.show)

  function isActive(href: string) {
    if (href === base) return pathname === base
    return pathname.startsWith(href)
  }

  return (
    <div className={`sticky top-0 z-40 bg-[#fdfaf6] border-b border-[#e8dcc8] transition-shadow duration-200 ${
      scrolled ? 'shadow-sm' : ''
    }`}>
      <nav className="max-w-3xl mx-auto flex flex-wrap">
        {tabs.map(tab => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-shrink-0 px-5 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
