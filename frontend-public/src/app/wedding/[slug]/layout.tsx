import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import WeddingNav from './WeddingNav'
import { parseTabCustomisation } from './data'
import FloatingEditButton from '@/components/FloatingEditButton'
import { getWedding } from '@/app/wedding/[slug]/data'
import { formatWeddingDate, daysUntilDate } from '@/lib/date'

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const wedding = await getWedding(slug)
  if (!wedding) return { title: 'Wedding Not Found — AltarWed' }

  // Display convention: bride (partnerTwoName) first per Jordan's wife-first preference.
  // DB convention is unchanged (partnerOneName = Groom, partnerTwoName = Bride).
  const title = `${wedding.partnerTwoName} & ${wedding.partnerOneName} — AltarWed`
  const description = wedding.ourStory
    ? wedding.ourStory.slice(0, 155) + '…'
    : `${wedding.partnerTwoName} and ${wedding.partnerOneName} are getting married. Join them to celebrate their covenant.`
  const image = wedding.heroPhotoUrl ?? 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&q=80'

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
  if (!wedding || !wedding.isPublished) notFound()


  const heroImage = wedding.heroPhotoUrl
    ?? 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1600&q=80'
  const countdown = wedding.weddingDate ? daysUntilDate(wedding.weddingDate) : null

  const hasStory    = !!wedding.ourStory
  const hasDetails  = !!(wedding.venueName || wedding.ceremonyTime || wedding.dressCode)
  const hasRegistry = !!(wedding.registryUrl1 || wedding.registryUrl2 || wedding.registryUrl3)
  const hasTravel   = !!(wedding.hotelName)

  // Parse the couple's tab customisations (hidden tabs + relabeled tabs).
  // Done on every layout render so changes from the editor show up after the
  // 60s revalidate window without a manual refresh. The parser is cheap (one
  // JSON.parse + one CSV split, both bounded by tiny inputs).
  const tabCustom = parseTabCustomisation(wedding)

  return (
    <div className="min-h-screen bg-[#fdfaf6] font-sans text-[#3b2f2f]">

      {/* ── Hero ── */}
      <section className="relative h-[85vh] min-h-[520px] flex items-end justify-center overflow-hidden">
        <Image
          src={heroImage}
          alt={`${wedding.partnerTwoName} and ${wedding.partnerOneName}`}
          fill className="object-cover" priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />

        <div className="relative z-10 text-center pb-14 px-6 w-full">
          {/* Tagline supports three states: empty string (user cleared, render nothing),
              null/undefined (never set, show default), or any text (use as-is).
              `||` would treat empty-string as falsy and force the default; we want
              the user to be able to opt out entirely. */}
          {wedding.heroTagline !== '' && (
            <p className="mb-3 text-xs uppercase tracking-[0.3em] text-white/70 font-light">
              {wedding.heroTagline ?? 'Together in covenant'}
            </p>
          )}
          <h1 className="font-serif text-5xl sm:text-7xl font-bold text-white leading-none">
            {wedding.partnerTwoName}
          </h1>
          <div className="my-4 flex items-center justify-center gap-4">
            <div className="h-px w-16 bg-[#d4af6a]/60" />
            <span className="font-serif text-2xl text-[#d4af6a]">&amp;</span>
            <div className="h-px w-16 bg-[#d4af6a]/60" />
          </div>
          <h1 className="font-serif text-5xl sm:text-7xl font-bold text-white leading-none">
            {wedding.partnerOneName}
          </h1>
          {wedding.weddingDate && (
            <p className="mt-6 text-base sm:text-lg text-white/85 tracking-wide">
              {formatWeddingDate(wedding.weddingDate)}
            </p>
          )}
          {countdown !== null && countdown > 0 && (
            <p className="mt-2 text-[#d4af6a] text-sm tracking-widest uppercase">
              {countdown} days away
            </p>
          )}
          {countdown !== null && countdown <= 0 && (
            <p className="mt-2 text-[#d4af6a] text-sm tracking-widest uppercase">Married!</p>
          )}
        </div>
      </section>

      {/* ── Scripture banner — more prominent per couple feedback ── */}
      {(wedding.scriptureText || wedding.scriptureReference) && (
        <section className="bg-gradient-to-b from-[#3b2f2f] to-[#4a1942] py-20 px-6 text-center relative">
          <div className="absolute inset-x-0 top-0 h-px bg-[#d4af6a]/40" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-[#d4af6a]/40" />
          {wedding.scriptureText && (
            <blockquote className={`font-serif italic text-[#fdfaf6] max-w-3xl mx-auto leading-relaxed drop-shadow-sm ${
              wedding.scriptureText.length > 300 ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl md:text-4xl'
            }`}>
              &ldquo;{wedding.scriptureText}&rdquo;
            </blockquote>
          )}
          {wedding.scriptureReference && (
            <p className="mt-6 text-[#d4af6a] text-sm sm:text-base tracking-[0.25em] uppercase font-medium">
              — {wedding.scriptureReference}
            </p>
          )}
        </section>
      )}

      {/* ── Sticky tab nav (client component) ── */}
      <WeddingNav
        slug={slug}
        hasStory={hasStory}
        hasDetails={hasDetails}
        hasParty={true}
        hasRegistry={hasRegistry}
        hasTravel={hasTravel}
        hiddenTabs={tabCustom.hidden}
        customLabels={tabCustom.labels}
      />

      {/* ── Tab content ── */}
      <div className="max-w-3xl mx-auto px-6 py-14">
        {children}
      </div>

      {/* Footer */}
      <footer className="border-t border-[#e8dcc8] py-12 text-center text-sm text-[#a08060] space-y-4">
        <p className="text-xs uppercase tracking-widest text-[#c4a882] font-medium">
          Created on AltarWed
        </p>
        <div>
          <p className="text-[#6b5344] mb-3">
            Getting married? Create your Christian wedding website for free.
          </p>
          <a
            href="https://app.altarwed.com/register"
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

      {/* Floating edit button — always shown so the couple can jump into the editor */}
      <FloatingEditButton />
    </div>
  )
}
