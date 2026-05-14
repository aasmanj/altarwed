import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import WeddingNav from './WeddingNav'
import PinGate from './PinGate'
import { getWedding } from '@/app/wedding/[slug]/data'

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const wedding = await getWedding(slug)
  if (!wedding) return { title: 'Wedding Not Found — AltarWed' }

  const title = `${wedding.partnerOneName} & ${wedding.partnerTwoName} — AltarWed`
  const description = wedding.ourStory
    ? wedding.ourStory.slice(0, 155) + '…'
    : `${wedding.partnerOneName} and ${wedding.partnerTwoName} are getting married. Join them to celebrate their covenant.`
  const image = wedding.heroPhotoUrl ?? 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&q=80'

  return {
    title,
    description,
    openGraph: {
      title, description, type: 'website',
      url: `https://www.altarwed.com/wedding/${slug}`,
      images: [{ url: image, width: 1200, height: 800, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
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
  const countdown = wedding.weddingDate ? daysUntil(wedding.weddingDate) : null

  const hasStory    = !!(wedding.ourStory || wedding.testimony || wedding.covenantStatement)
  const hasDetails  = !!(wedding.venueName || wedding.ceremonyTime || wedding.dressCode)
  const hasRegistry = !!(wedding.registryUrl1 || wedding.registryUrl2 || wedding.registryUrl3)
  const hasTravel   = !!(wedding.hotelName)

  return (
    <div className="min-h-screen bg-[#fdfaf6] font-sans text-[#3b2f2f]">

      {/* ── Hero ── */}
      <section className="relative h-[85vh] min-h-[520px] flex items-end justify-center overflow-hidden">
        <Image
          src={heroImage}
          alt={`${wedding.partnerOneName} and ${wedding.partnerTwoName}`}
          fill className="object-cover" priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />

        <div className="relative z-10 text-center pb-14 px-6 w-full">
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-white/70 font-light">
            Together in covenant
          </p>
          <h1 className="font-serif text-5xl sm:text-7xl font-bold text-white leading-none">
            {wedding.partnerOneName}
          </h1>
          <div className="my-4 flex items-center justify-center gap-4">
            <div className="h-px w-16 bg-[#d4af6a]/60" />
            <span className="font-serif text-2xl text-[#d4af6a]">&amp;</span>
            <div className="h-px w-16 bg-[#d4af6a]/60" />
          </div>
          <h1 className="font-serif text-5xl sm:text-7xl font-bold text-white leading-none">
            {wedding.partnerTwoName}
          </h1>
          {wedding.weddingDate && (
            <p className="mt-6 text-base sm:text-lg text-white/85 tracking-wide">
              {formatDate(wedding.weddingDate)}
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

      {/* ── Scripture banner ── */}
      {(wedding.scriptureText || wedding.scriptureReference) && (
        <section className="bg-[#3b2f2f] py-12 px-6 text-center">
          {wedding.scriptureText && (
            <blockquote className={`font-serif italic text-[#fdfaf6]/90 max-w-2xl mx-auto leading-relaxed ${
              wedding.scriptureText.length > 300 ? 'text-base' : 'text-xl sm:text-2xl'
            }`}>
              &ldquo;{wedding.scriptureText}&rdquo;
            </blockquote>
          )}
          {wedding.scriptureReference && (
            <p className="mt-4 text-[#d4af6a] text-xs tracking-[0.2em] uppercase">
              {wedding.scriptureReference}
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
      />

      {/* ── Tab content — gated by PIN if couple has enabled it ── */}
      <div className="max-w-3xl mx-auto px-6 py-14">
        {wedding.isPinProtected
          ? <PinGate slug={slug}>{children}</PinGate>
          : children}
      </div>

      {/* Footer */}
      <footer className="border-t border-[#e8dcc8] py-10 text-center text-sm text-[#a08060]">
        <a href="https://www.altarwed.com" className="font-serif text-[#3b2f2f] font-semibold hover:underline">
          AltarWed
        </a>
        <span className="mx-2">·</span>
        Faith-based wedding planning
      </footer>
    </div>
  )
}
