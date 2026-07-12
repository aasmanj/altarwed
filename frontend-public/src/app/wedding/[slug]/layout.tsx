import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import WeddingNav from './WeddingNav'
import ComingSoon from './ComingSoon'
import { parseTabCustomisation, hasWeddingPartyMembers, hasWeddingPhotos, getAllBlocks, computeTabsWithContent } from './data'
import { getWedding } from '@/app/wedding/[slug]/data'
import { formatWeddingDate, daysUntilDate } from '@/lib/date'
import { safeColor } from '@/lib/safeColor'
import { safeNameFont, safeNameFontWeight } from '@/lib/safeFont'
import { accentColorTokens } from '@/lib/accentColorTokens'

// NOTE: intentionally NO generateStaticParams here. Pre-rendering the published catalog
// at build was considered as a 504 mitigation but rejected: the per-slug prerender calls
// getWedding(), which THROWS on any backend 5xx/timeout, so a backend hiccup mid-build
// would fail the whole deploy (or bake a degraded page into the cache), and fanning out
// ~7 fetches x N tabs x hundreds of slugs against the single backend instance can trigger
// the very restart it aimed to render around. The 504 is instead handled at request time
// by the AbortSignal timeouts in data.ts (graceful error page / stale ISR) plus backend
// graceful shutdown. Wedding pages stay on-demand ISR (revalidate 60).

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const wedding = await getWedding(slug)
  if (!wedding) return { title: 'Wedding Not Found | AltarWed' }

  // Unpublished sites render a "coming soon" page (200), so they must be marked
  // noindex, otherwise Google could index a draft slug that returns 200 instead
  // of the old 404. The site becomes indexable automatically once published.
  if (!wedding.isPublished) {
    return {
      title: `${wedding.partnerTwoName} & ${wedding.partnerOneName} | Coming Soon`,
      description: 'This wedding website is coming soon on AltarWed.',
      robots: { index: false, follow: false },
    }
  }

  // Display convention: bride (partnerTwoName) first per Jordan's wife-first preference.
  // DB convention is unchanged (partnerOneName = Groom, partnerTwoName = Bride).
  const title = `${wedding.partnerTwoName} & ${wedding.partnerOneName} | AltarWed`
  const description = wedding.ourStory
    ? wedding.ourStory.slice(0, 155) + '…'
    : `${wedding.partnerTwoName} and ${wedding.partnerOneName} are getting married. Join them to celebrate their covenant.`
  // Fallback share image when the couple has not uploaded a hero. Self-hosted
  // in /public so the OG card Facebook/Pinterest renders for every shared
  // wedding site (the core of the viral loop) never depends on a third-party
  // hotlink that can rate-limit or 404. Next resolves this relative URL against
  // metadataBase (https://www.altarwed.com) into the absolute og:image FB needs.
  const image = wedding.heroPhotoUrl ?? '/hero-wedding.jpg'

  // All tab sub-routes (/story, /details, /travel, etc.) inherit this canonical
  // from the layout, so Google treats them as alternates of the main wedding page
  // rather than independent duplicate pages.
  const canonicalUrl = `https://www.altarwed.com/wedding/${slug}`

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title, description, type: 'website',
      url: canonicalUrl,
      images: [{ url: image, width: 1200, height: 800, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  }
}

export default async function WeddingLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const wedding = await getWedding(slug)
  if (!wedding) notFound()
  if (!wedding.isPublished) return <ComingSoon wedding={wedding} />

  const heroImage = wedding.heroPhotoUrl ?? '/hero-wedding.jpg'
  const countdown = wedding.weddingDate ? daysUntilDate(wedding.weddingDate) : null

  // Gate each nav tab on REAL content. A tab shows if it has scalar content OR
  // block-editor content. The block editor is now the primary authoring surface,
  // so most couples fill a tab via blocks and leave the legacy scalar field empty;
  // without the block check those tabs (e.g. a STORY_ENTRY with no ourStory scalar)
  // would be hidden and their content unreachable. All three fetches are 60s-cached.
  const [hasPartyMembers, hasPhotosPresent, allBlocks] = await Promise.all([
    hasWeddingPartyMembers(wedding.id),
    hasWeddingPhotos(slug),
    getAllBlocks(slug),
  ])
  const tabsWithContent = computeTabsWithContent(allBlocks, wedding, hasPartyMembers, hasPhotosPresent)

  // OUR_STORY / DETAILS / REGISTRY / PHOTOS pages render blocks (via TabBlocks), so a
  // tab the couple filled only via the block editor must show even with the scalar
  // field empty. The Photos page (#332) now flows through TabBlocks too, so a couple
  // whose only Photos content is a HEADING/TEXT block (no uploaded photos) still gets
  // a visible, reachable nav link instead of a dead tab.
  const hasStory    = !!wedding.ourStory || tabsWithContent.has('OUR_STORY')
  const hasDetails  = !!(wedding.venueName || wedding.ceremonyTime || wedding.dressCode) || tabsWithContent.has('DETAILS')
  const hasRegistry = !!(wedding.registryUrl1 || wedding.registryUrl2 || wedding.registryUrl3) || tabsWithContent.has('REGISTRY')
  const hasPhotos   = hasPhotosPresent || tabsWithContent.has('PHOTOS')
  // Travel / Wedding Party pages render from their own hotels/party tables, NOT from
  // blocks, so gate them on that content only. ORing in block content here would
  // reveal the tab while the page renders "coming soon" (a dead tab).
  const hasTravel   = !!(wedding.hotelName)
  const hasParty    = hasPartyMembers

  // Parse the couple's tab customisations (hidden tabs + relabeled tabs).
  // Done on every layout render so changes from the editor show up after the
  // 60s revalidate window without a manual refresh. The parser is cheap (one
  // JSON.parse + one CSV split, both bounded by tiny inputs).
  const tabCustom = parseTabCustomisation(wedding)

  // schema.org images must be absolute URLs. heroImage is either an absolute
  // Blob URL (couple uploaded) or the relative /public fallback, so prefix the
  // origin only in the relative case.
  const heroImageAbsolute = heroImage.startsWith('http')
    ? heroImage
    : `https://www.altarwed.com${heroImage}`

  // schema.org Event structured data. Google uses this for rich snippets
  // (event date pill, location, calendar integration). startDate must be ISO
  // 8601; ceremonyTime is free-form ("4:00 PM") so we only include the date
  // portion to avoid emitting malformed datetimes that Google's validator
  // rejects.
  const eventJsonLd = wedding.weddingDate ? {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `${wedding.partnerTwoName} & ${wedding.partnerOneName}'s Wedding`,
    startDate: wedding.weddingDate,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    image: [heroImageAbsolute],
    description: wedding.ourStory
      ? wedding.ourStory.slice(0, 300)
      : `${wedding.partnerTwoName} and ${wedding.partnerOneName} are getting married.`,
    ...(wedding.venueName && {
      location: {
        '@type': 'Place',
        name: wedding.venueName,
        address: [wedding.venueAddress, wedding.venueCity, wedding.venueState]
          .filter(Boolean).join(', ') || undefined,
      },
    }),
    organizer: {
      '@type': 'Organization',
      name: 'AltarWed',
      url: 'https://www.altarwed.com',
    },
  } : null

  // Validate every couple-controlled color before it reaches a style sink. The
  // backend enforces @Pattern but this guards the SSR path against any future
  // direct DB writes or bugs. See src/lib/safeColor.ts for the shared rule.
  const accentColor = safeColor(wedding.accentColor, '#d4af6a')
  // Contrast guard (issue #350): derive readable per-surface tokens from the accent so accent
  // TEXT stays legible on the dark panels and the light page, and button labels stay legible on
  // an accent fill, for ANY accent the couple picks. Decorative fills/dividers keep raw --accent.
  const accentTokens = accentColorTokens(accentColor)
  const heroTaglineColor = safeColor(wedding.heroTaglineColor, 'rgba(255,255,255,0.7)')
  const scriptureBackgroundColor = safeColor(wedding.scriptureBackgroundColor, undefined)
  // Couple-chosen font for the hero names. safeNameFont maps the stored key to an
  // allowlisted font-family stack (never the raw value) and defaults to the serif;
  // the paired weight avoids faux-bold on single-weight script faces.
  const nameFont = safeNameFont(wedding.nameFont)
  const nameFontWeight = safeNameFontWeight(wedding.nameFont)

  return (
    <div className="min-h-screen bg-[#fdfaf6] font-sans text-[#3b2f2f]">
      <style>{`:root { --accent: ${accentColor}; --accent-on-dark: ${accentTokens.onDark}; --accent-on-light: ${accentTokens.onLight}; --on-accent: ${accentTokens.onAccent}; --name-font: ${nameFont}; --name-font-weight: ${nameFontWeight}; }`}</style>

      {eventJsonLd && (
        <script
          type="application/ld+json"
          // JSON.stringify does NOT escape "</", a couple-controlled name
          // containing "</script>" would otherwise break out of this inline
          // <script> block and execute arbitrary JS. Replace forward-slashes
          // in close-tags with the unicode escape; valid JSON parsers accept
          // / as "/", browsers do not treat < as <.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(eventJsonLd)
              .replace(/</g, '\\u003c')
              .replace(/>/g, '\\u003e')
              .replace(/&/g, '\\u0026'),
          }}
        />
      )}

      {/* ── Hero ── */}
      <section className="relative h-[85vh] min-h-[520px] flex items-end justify-center overflow-hidden">
        <Image
          src={heroImage}
          alt={`${wedding.partnerTwoName} and ${wedding.partnerOneName}`}
          fill sizes="100vw" className="object-cover" priority
          style={{
            objectPosition: `${(wedding.heroFocalPointX ?? 0.5) * 100}% ${(wedding.heroFocalPointY ?? 0.5) * 100}%`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />

        <div className="relative z-10 text-center pb-14 px-6 w-full max-w-4xl mx-auto">
          {/* Tagline supports three states: empty string (user cleared, render nothing),
              null/undefined (never set, show default), or any text (use as-is).
              `||` would treat empty-string as falsy and force the default; we want
              the user to be able to opt out entirely. */}
          {wedding.heroTagline !== '' && (
            <p
              className="mb-3 text-xs uppercase tracking-[0.3em] font-light"
              style={{ color: heroTaglineColor }}
            >
              {wedding.heroTagline ?? 'Together in covenant'}
            </p>
          )}
          <h1
            className="font-serif text-4xl sm:text-6xl md:text-7xl font-bold text-white leading-tight break-words text-balance"
            style={{ fontFamily: 'var(--name-font)', fontWeight: 'var(--name-font-weight)' }}
          >
            {wedding.partnerTwoName}
          </h1>
          <div className="my-4 flex items-center justify-center gap-4">
            <div className="h-px w-16 bg-[color-mix(in_srgb,var(--accent)_60%,transparent)]" />
            <span
              className="font-serif text-2xl text-[var(--accent-on-dark)]"
              style={{ fontFamily: 'var(--name-font)' }}
              aria-hidden="true"
            >
              &amp;
            </span>
            <div className="h-px w-16 bg-[color-mix(in_srgb,var(--accent)_60%,transparent)]" />
          </div>
          <p
            className="font-serif text-4xl sm:text-6xl md:text-7xl font-bold text-white leading-tight break-words text-balance"
            style={{ fontFamily: 'var(--name-font)', fontWeight: 'var(--name-font-weight)' }}
          >
            {wedding.partnerOneName}
          </p>
          {wedding.weddingDate && (
            <p className="mt-6 text-base sm:text-lg text-white/85 tracking-wide">
              {formatWeddingDate(wedding.weddingDate)}
            </p>
          )}
          {countdown !== null && countdown > 0 && (
            <p
              className="mt-2 text-[var(--accent-on-dark)] text-sm tracking-widest uppercase"
              aria-label={`${countdown} days until the wedding`}
            >
              {countdown} days away
            </p>
          )}
          {countdown !== null && countdown <= 0 && (
            <p className="mt-2 text-[var(--accent-on-dark)] text-sm tracking-widest uppercase">Married!</p>
          )}
        </div>
      </section>

      {/* ── Scripture banner, more prominent per couple feedback ── */}
      {(wedding.scriptureText || wedding.scriptureReference) && (
        <section
          className={`${scriptureBackgroundColor ? '' : 'bg-gradient-to-b from-[#3b2f2f] to-[#4a1942]'} py-20 px-6 text-center relative`}
          style={scriptureBackgroundColor ? { backgroundColor: scriptureBackgroundColor } : undefined}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-[color-mix(in_srgb,var(--accent)_40%,transparent)]" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-[color-mix(in_srgb,var(--accent)_40%,transparent)]" />
          {wedding.scriptureText && (
            <blockquote className={`font-serif italic text-[#fdfaf6] max-w-3xl mx-auto leading-relaxed drop-shadow-sm ${
              wedding.scriptureText.length > 300 ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl md:text-4xl'
            }`}>
              &ldquo;{wedding.scriptureText}&rdquo;
            </blockquote>
          )}
          {wedding.scriptureReference && (
            <p className="mt-6 text-[var(--accent-on-dark)] text-sm sm:text-base tracking-[0.25em] uppercase font-medium">
              {wedding.scriptureReference}
              {wedding.scriptureTranslation && (
                <span className="text-white/40 ml-2 normal-case tracking-normal text-sm">({wedding.scriptureTranslation})</span>
              )}
            </p>
          )}
        </section>
      )}

      {/* ── Sticky tab nav (client component) ── */}
      <WeddingNav
        slug={slug}
        hasStory={hasStory}
        hasDetails={hasDetails}
        hasParty={hasParty}
        hasPhotos={hasPhotos}
        hasRegistry={hasRegistry}
        hasTravel={hasTravel}
        hiddenTabs={tabCustom.hidden}
        customLabels={tabCustom.labels}
      />

      {/* ── Tab content ── */}
      {/* scroll-mt-14 (56px) clears the ~51px sticky nav so any scrollIntoView
          targeting <main>, e.g. Next's fallback scroll for tab links rendered
          OUTSIDE WeddingNav (Explore cards etc.), lands the content below the
          pinned nav instead of underneath it. The nav's own tab links position
          explicitly with the measured nav height; see WeddingNav. */}
      <main id="main" className="max-w-3xl mx-auto px-6 py-14 scroll-mt-14">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e8dcc8] py-12 text-center text-sm text-[#8a6a4a] space-y-4">
        <p className="text-xs uppercase tracking-widest text-[#c4a882] font-medium">
          Created on AltarWed
        </p>
        <div>
          <p className="text-[#6b5344] mb-3">
            Getting married? Create your Christian wedding website for free.
          </p>
          <a
            href="https://app.altarwed.com/register?utm_source=wedding-site&utm_medium=referral&utm_campaign=viral-footer"
            className="inline-block px-6 py-2.5 rounded-full bg-[#3b2f2f] text-white text-xs font-semibold hover:bg-[#5c4033] transition"
          >
            Start for free →
          </a>
        </div>
        <div className="pt-2 flex items-center justify-center gap-4 text-xs text-[#c4a882]">
          <a href="https://www.altarwed.com" className="hover:text-[#3b2f2f] transition">AltarWed</a>
          <span>·</span>
          <a href="https://www.altarwed.com/privacy" className="hover:text-[#3b2f2f] transition">Privacy Policy</a>
          <span>·</span>
          <a href="https://www.altarwed.com/terms" className="hover:text-[#3b2f2f] transition">Terms</a>
        </div>
      </footer>

    </div>
  )
}
