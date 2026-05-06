'use client'

import { useEffect, useState } from 'react'

interface Tab { id: string; label: string }

export default function WeddingNav({
  hasStory, hasDetails, hasParty, hasRegistry, hasTravel,
}: {
  hasStory: boolean
  hasDetails: boolean
  hasParty: boolean
  hasRegistry: boolean
  hasTravel: boolean
}) {
  const tabs: Tab[] = [
    hasStory    && { id: 'story',    label: 'Our Story' },
    hasDetails  && { id: 'details',  label: 'Details' },
    hasParty    && { id: 'party',    label: 'Wedding Party' },
    hasRegistry && { id: 'registry', label: 'Registry' },
    hasTravel   && { id: 'travel',   label: 'Travel' },
    { id: 'prayer', label: 'Prayer Wall' },
  ].filter(Boolean) as Tab[]

  const [active, setActive] = useState<string>(tabs[0]?.id ?? '')
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setStuck(window.scrollY > 60)

      // Highlight active section based on scroll position
      for (const tab of [...tabs].reverse()) {
        const el = document.getElementById(tab.id)
        if (el && el.getBoundingClientRect().top <= 120) {
          setActive(tab.id)
          break
        }
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [tabs])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const offset = 72 // nav height
    const top = el.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top, behavior: 'smooth' })
    setActive(id)
  }

  if (tabs.length === 0) return null

  return (
    <div className={`sticky top-0 z-40 transition-shadow ${
      stuck ? 'bg-white shadow-sm border-b border-[#e8dcc8]' : 'bg-white/95 backdrop-blur border-b border-[#e8dcc8]'
    }`}>
      <div className="max-w-3xl mx-auto px-4 overflow-x-auto">
        <nav className="flex gap-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => scrollTo(tab.id)}
              className={`px-4 py-4 text-sm font-medium whitespace-nowrap transition border-b-2 ${
                active === tab.id
                  ? 'border-[#d4af6a] text-[#3b2f2f]'
                  : 'border-transparent text-[#a08060] hover:text-[#3b2f2f]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
