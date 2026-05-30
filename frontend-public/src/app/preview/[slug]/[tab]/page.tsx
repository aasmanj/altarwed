// Preview route: /preview/[slug]/[tab]
// Renders a block-driven WYSIWYG preview of one tab inside the SideBySideEditor iframe.
// Includes the hero + scripture banner so couples see a true-to-life rendering of
// what guests will experience, minus the tab navigation (the editor's own tab bar
// is the source of truth for which tab is being edited).
//
// Authorization: the slug acts as the unguessable secret. Same model as the editor
// preview links on theknot.com and zola.com. Robots noindex prevents accidental
// Google indexing of draft pages.

import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { type WeddingPartyMember, type WeddingPhoto } from '@/components/blocks/BlockRenderer'
import { getWedding, getBlocks, type BlockTab } from '@/app/wedding/[slug]/data'
import { formatWeddingDate, daysUntilDate } from '@/lib/date'
import HeroLive from './HeroLive'
import BlockListLive from './BlockListLive'

export const metadata: Metadata = { robots: { index: false, follow: false } }

const VALID_TABS = new Set([
  'HOME', 'OUR_STORY', 'DETAILS', 'WEDDING_PARTY',
  'REGISTRY', 'TRAVEL', 'PHOTOS', 'RSVP',
])

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
    const res = await fetch(`${API}/api/v1/wedding-photos/website/slug/${slug}`, { cache: 'no-store' })
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

  const [wedding, blocks] = await Promise.all([
    getWedding(slug),
    getBlocks(slug, tab as BlockTab),
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

  return (
    <div className="min-h-screen bg-[#fdfaf6] font-sans text-[#3b2f2f]">

      {/* Draft watermark, only visible on unpublished sites so couples know
          this preview is private. Sticky so it stays in view during scroll. */}
      {!wedding.isPublished && (
        <div className="sticky top-0 z-40 bg-amber-100 border-b border-amber-300 px-4 py-1.5 text-center">
          <span className="text-xs font-semibold text-amber-900 uppercase tracking-wider">
            Draft preview &middot; only you can see this
          </span>
        </div>
      )}

      {/* Hero, compact for the editor iframe (smaller than the public site's
          85vh hero so the editor can see content blocks without scrolling) */}
      <section className="relative h-[40vh] min-h-[260px] flex items-end justify-center overflow-hidden">
        <Image
          src={heroImage}
          alt={`${wedding.partnerTwoName} and ${wedding.partnerOneName}`}
          fill className="object-cover" priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />

        {/* Client component that listens for postMessage from the editor and updates
            tagline/names without a server round-trip. The editor sends an event on
            every keystroke; this component patches the DOM directly. */}
        <HeroLive
          initialTagline={wedding.heroTagline}
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
        <section className="bg-gradient-to-b from-[#3b2f2f] to-[#4a1942] py-10 px-6 text-center relative">
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
          initialBlocks={blocks}
          wedding={wedding}
          partyMembers={partyMembers}
          photos={photos}
        />
      </main>

      {/* Footer, matches public site for visual consistency */}
      <footer className="border-t border-[#e8dcc8] py-8 text-center text-xs text-[#a08060]">
        <span className="font-serif text-[#3b2f2f] font-semibold">AltarWed</span>
        <span className="mx-2">·</span>
        Faith-based wedding planning
      </footer>
    </div>
  )
}
