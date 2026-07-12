// Preview route: /preview/[slug]/[tab]
// Renders a block-driven WYSIWYG preview of one tab inside the SideBySideEditor iframe.
// Includes the hero + scripture banner so couples see a true-to-life rendering of
// what guests will experience. Tab navigation lets couples click between sections
// without returning to the editor.
//
// Authorization: the slug acts as the unguessable secret. Same model as the editor
// preview links on theknot.com and zola.com. Robots noindex prevents accidental
// Google indexing of draft pages.

import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { type WeddingPartyMember, type WeddingPhoto } from '@/components/blocks/BlockRenderer'
import { getWedding, getBlocks, type BlockTab, parseTabCustomisation } from '@/app/wedding/[slug]/data'
import { formatWeddingDate, daysUntilDate } from '@/lib/date'
import { safeColor } from '@/lib/safeColor'
import { safeNameFont, safeNameFontWeight } from '@/lib/safeFont'
import HeroLive from './HeroLive'
import BlockListLive from './BlockListLive'
import TabSwitchListener from './TabSwitchListener'

export const metadata: Metadata = { robots: { index: false, follow: false } }

const VALID_TABS = new Set([
  'HOME', 'OUR_STORY', 'DETAILS', 'WEDDING_PARTY',
  'REGISTRY', 'TRAVEL', 'PHOTOS', 'RSVP',
])

// All 8 tabs with their default labels and lowercase URL segments.
// Shown in the preview nav regardless of hiddenTabs so couples can navigate
// to any section while editing; hidden tabs are marked with a badge.
const ALL_TABS: { tab: BlockTab; label: string; segment: string }[] = [
  { tab: 'HOME',          label: 'Home',          segment: 'home' },
  { tab: 'OUR_STORY',     label: 'Our Story',     segment: 'our_story' },
  { tab: 'DETAILS',       label: 'The Wedding',   segment: 'details' },
  { tab: 'WEDDING_PARTY', label: 'Wedding Party', segment: 'wedding_party' },
  { tab: 'TRAVEL',        label: 'Travel',        segment: 'travel' },
  { tab: 'REGISTRY',      label: 'Registry',      segment: 'registry' },
  { tab: 'PHOTOS',        label: 'Photos',        segment: 'photos' },
  { tab: 'RSVP',          label: 'RSVP',          segment: 'rsvp' },
]

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'

async function getPartyMembers(websiteId: string): Promise<WeddingPartyMember[]> {
  try {
    const res = await fetch(`${API}/api/v1/wedding-party/website/${websiteId}`, { cache: 'no-store' })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

async function getPhotos(slug: string): Promise<WeddingPhoto[]> {
  try {
    // /preview (not /slug) so a draft's photos still render for the owner (#91).
    const res = await fetch(`${API}/api/v1/wedding-photos/website/preview/${slug}`, { cache: 'no-store' })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ slug: string; tab: string }>
}) {
  const { slug, tab: rawTab } = await params
  const tab = rawTab.toUpperCase()

  if (!VALID_TABS.has(tab)) notFound()
  // Narrowed by the VALID_TABS check above (VALID_TABS is a Set<string> so TS
  // cannot narrow it directly); safe to treat as BlockTab from here on.
  const currentTab = tab as BlockTab

  // fresh=true: the preview is owner-only and must reflect just-saved edits and
  // publish state immediately, so bypass the 60s ISR data cache.
  const [wedding, blocks] = await Promise.all([
    getWedding(slug, true),
    getBlocks(slug, currentTab, true),
  ])

  // Preview must render drafts, that is the whole point of WYSIWYG.
  // The route is noindex'd; the slug is unguessable.
  if (!wedding) notFound()

  // Fetch party + photos unconditionally on the preview route. The block list
  // is now live-updated over postMessage, so adding a WEDDING_PARTY_GRID block
  // after the iframe loaded would otherwise render with empty data until the
  // next full reload. Cost is two cheap API calls per iframe hydration.
  const [partyMembers, photos] = await Promise.all([
    getPartyMembers(wedding.id),
    getPhotos(slug),
  ])

  const heroImage = wedding.heroPhotoUrl ?? '/hero-wedding.jpg'
  const countdown = wedding.weddingDate ? daysUntilDate(wedding.weddingDate) : null
  const tabCustom = parseTabCustomisation(wedding)

  const accentColor = safeColor(wedding.accentColor, '#d4af6a')
  const scriptureBackgroundColor = safeColor(wedding.scriptureBackgroundColor, undefined)
  // Mirror the live layout's font vars so the dashboard preview reflects the chosen font.
  const nameFont = safeNameFont(wedding.nameFont)
  const nameFontWeight = safeNameFontWeight(wedding.nameFont)

  return (
    <div className="min-h-screen bg-[#fdfaf6] font-sans text-[#3b2f2f]">
      <style>{`:root { --accent: ${accentColor}; --name-font: ${nameFont}; --name-font-weight: ${nameFontWeight}; }`}</style>

      {/* Handles the editor's tab-switch postMessage with a client-side (RSC)
          navigation instead of the iframe reload this route used to require
          on every tab click (issue #310). Renders nothing. */}
      <TabSwitchListener slug={slug} tab={currentTab} />

      {/* Draft watermark, only visible on unpublished sites so couples know
          this preview is private. Sticky so it stays in view during scroll. */}
      {!wedding.isPublished && (
        <div className="sticky top-0 z-40 bg-amber-100 border-b border-amber-300 px-4 py-1.5 text-center">
          <span className="text-xs font-semibold text-amber-900 uppercase tracking-wider">
            Draft preview &middot; only you can see this
          </span>
        </div>
      )}

      {/* Preview tab navigation, shows all 8 tabs so couples can navigate
          between sections while previewing. Hidden tabs get a "(hidden)" badge
          so the couple knows guests won't see them. */}
      <nav
        aria-label="Preview sections"
        className="bg-[#fdfaf6] border-b border-[#e8dcc8]"
      >
        <div className="max-w-3xl mx-auto flex overflow-x-auto scrollbar-none">
          {ALL_TABS.map(({ tab: tabKey, segment }) => {
            const isActive = tab === tabKey
            const isHidden = tabCustom.hidden.has(tabKey)
            const displayLabel = tabCustom.labels[tabKey] ?? ALL_TABS.find(t => t.tab === tabKey)!.label
            return (
              <a
                key={tabKey}
                href={`/preview/${slug}/${segment}`}
                aria-current={isActive ? 'page' : undefined}
                className={`shrink-0 flex-1 text-center px-3 py-3 text-[11px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-[#d4af6a] text-[#3b2f2f]'
                    : 'border-transparent text-[#8a6a4a] hover:text-[#3b2f2f]'
                }`}
              >
                {displayLabel}
                {isHidden && (
                  <span className="ml-1 text-[9px] text-[#8a6a4a] opacity-70">(hidden)</span>
                )}
              </a>
            )
          })}
        </div>
      </nav>

      {/* Hero, compact for the editor iframe (smaller than the public site's
          85vh hero so the editor can see content blocks without scrolling) */}
      <section className="relative h-[40vh] min-h-[260px] flex items-end justify-center overflow-hidden">
        <Image
          src={heroImage}
          alt={`${wedding.partnerTwoName} and ${wedding.partnerOneName}`}
          fill className="object-cover" priority
          style={{
            objectPosition: `${(wedding.heroFocalPointX ?? 0.5) * 100}% ${(wedding.heroFocalPointY ?? 0.5) * 100}%`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />

        {/* Client component that listens for postMessage from the editor and updates
            tagline/names without a server round-trip. The editor sends an event on
            every keystroke; this component patches the DOM directly. */}
        <HeroLive
          initialTagline={wedding.heroTagline}
          initialTaglineColor={wedding.heroTaglineColor}
          initialNameFont={wedding.nameFont}
          partnerOneName={wedding.partnerOneName}
          partnerTwoName={wedding.partnerTwoName}
        >
          {wedding.weddingDate && (
            <p className="mt-3 text-sm text-white/85 tracking-wide">
              {formatWeddingDate(wedding.weddingDate)}
            </p>
          )}
          {countdown !== null && countdown > 0 && (
            <p className="mt-1 text-[#d4af6a] text-[10px] tracking-widest uppercase">
              {countdown} days away
            </p>
          )}
        </HeroLive>
      </section>

      {/* Scripture banner, same as the public site */}
      {(wedding.scriptureText || wedding.scriptureReference) && (
        <section
          className={`${scriptureBackgroundColor ? '' : 'bg-gradient-to-b from-[#3b2f2f] to-[#4a1942]'} py-10 px-6 text-center relative`}
          style={scriptureBackgroundColor ? { backgroundColor: scriptureBackgroundColor } : undefined}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-[#d4af6a]/40" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-[#d4af6a]/40" />
          {wedding.scriptureText && (
            <blockquote className="font-serif italic text-[#fdfaf6] max-w-3xl mx-auto leading-relaxed text-lg sm:text-xl">
              &ldquo;{wedding.scriptureText}&rdquo;
            </blockquote>
          )}
          {wedding.scriptureReference && (
            <p className="mt-3 text-[#d4af6a] text-xs tracking-[0.25em] uppercase font-medium">
              {wedding.scriptureReference}
              {wedding.scriptureTranslation && (
                <span className="text-white/40 ml-2 normal-case tracking-normal">({wedding.scriptureTranslation})</span>
              )}
            </p>
          )}
        </section>
      )}

      {/* Tab content, blocks render here.
          BlockListLive is a client component that takes the SSR-hydrated blocks
          list as initial state, then swaps it out in response to postMessage
          events from the editor. Lets text edits, add/delete/reorder, and image
          uploads all reflect in the preview without an iframe reload. */}
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <BlockListLive
          tab={currentTab}
          initialBlocks={blocks}
          wedding={wedding}
          partyMembers={partyMembers}
          photos={photos}
        />
      </main>

      {/* Footer, matches public site for visual consistency */}
      <footer className="border-t border-[#e8dcc8] py-8 text-center text-xs text-[#8a6a4a]">
        <span className="font-serif text-[#3b2f2f] font-semibold">AltarWed</span>
        <span className="mx-2">·</span>
        Faith-based wedding planning
      </footer>
    </div>
  )
}
