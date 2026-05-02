import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RegistryItem {
  label: string
  url: string
}

interface WeddingWebsite {
  id: string
  slug: string
  isPublished: boolean
  partnerOneName: string
  partnerTwoName: string
  weddingDate: string | null
  heroPhotoUrl: string | null
  ourStory: string | null
  testimony: string | null
  covenantStatement: string | null
  scriptureReference: string | null
  scriptureText: string | null
  venueName: string | null
  venueAddress: string | null
  venueCity: string | null
  venueState: string | null
  ceremonyTime: string | null
  dressCode: string | null
  hotelName: string | null
  hotelUrl: string | null
  hotelDetails: string | null
  registryUrl1: string | null
  registryLabel1: string | null
  registryUrl2: string | null
  registryLabel2: string | null
  registryUrl3: string | null
  registryLabel3: string | null
  rsvpDeadline: string | null
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getWedding(slug: string): Promise<WeddingWebsite | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'
  try {
    const res = await fetch(`${apiUrl}/api/v1/wedding-websites/slug/${slug}`, {
      next: { revalidate: 60 }, // ISR: revalidate every 60s
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`API error ${res.status}`)
    return res.json()
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Metadata (Open Graph — drives Facebook / Pinterest previews)
// ---------------------------------------------------------------------------

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
      title,
      description,
      type: 'website',
      url: `https://www.altarwed.com/wedding/${slug}`,
      images: [{ url: image, width: 1200, height: 800, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

function registryLinks(w: WeddingWebsite): RegistryItem[] {
  const items: RegistryItem[] = []
  if (w.registryUrl1) items.push({ label: w.registryLabel1 ?? 'Registry', url: w.registryUrl1 })
  if (w.registryUrl2) items.push({ label: w.registryLabel2 ?? 'Registry', url: w.registryUrl2 })
  if (w.registryUrl3) items.push({ label: w.registryLabel3 ?? 'Registry', url: w.registryUrl3 })
  return items
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function WeddingPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const wedding = await getWedding(slug)

  if (!wedding || !wedding.isPublished) notFound()

  const heroImage = wedding.heroPhotoUrl
    ?? 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1600&q=80'
  const countdown = wedding.weddingDate ? daysUntil(wedding.weddingDate) : null
  const registry = registryLinks(wedding)

  return (
    <div className="min-h-screen bg-[#fdfaf6] font-sans text-[#3b2f2f]">

      {/* ── Hero ── */}
      <section className="relative h-[90vh] min-h-[560px] flex items-center justify-center text-center overflow-hidden">
        <img
          src={heroImage}
          alt={`${wedding.partnerOneName} and ${wedding.partnerTwoName}`}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative z-10 px-6">
          <p className="mb-4 text-sm uppercase tracking-[0.25em] text-white/80 font-light">
            We&rsquo;re getting married
          </p>
          <h1 className="font-serif text-5xl sm:text-7xl font-bold text-white leading-tight">
            {wedding.partnerOneName}
            <span className="block text-3xl sm:text-4xl font-light my-3 text-[#d4af6a]">&amp;</span>
            {wedding.partnerTwoName}
          </h1>
          {wedding.weddingDate && (
            <p className="mt-6 text-lg sm:text-xl text-white/90">
              {formatDate(wedding.weddingDate)}
            </p>
          )}
          {countdown !== null && countdown > 0 && (
            <p className="mt-3 text-[#d4af6a] text-base tracking-wide">
              {countdown} days to go
            </p>
          )}
          {countdown !== null && countdown <= 0 && (
            <p className="mt-3 text-[#d4af6a] text-base tracking-wide">
              We&rsquo;re married! 🎉
            </p>
          )}
        </div>
      </section>

      {/* ── Scripture ── */}
      {(wedding.scriptureText || wedding.scriptureReference) && (
        <section className="bg-[#3b2f2f] py-16 px-6 text-center">
          {wedding.scriptureText && (
            <blockquote className="font-serif text-xl sm:text-2xl italic text-[#fdfaf6]/90 max-w-2xl mx-auto leading-relaxed">
              &ldquo;{wedding.scriptureText}&rdquo;
            </blockquote>
          )}
          {wedding.scriptureReference && (
            <p className="mt-4 text-[#d4af6a] text-sm tracking-widest uppercase">
              {wedding.scriptureReference}
            </p>
          )}
        </section>
      )}

      <div className="max-w-3xl mx-auto px-6 py-16 space-y-20">

        {/* ── Our Story ── */}
        {wedding.ourStory && (
          <Section title="Our Story">
            <Prose text={wedding.ourStory} />
          </Section>
        )}

        {/* ── Testimony ── */}
        {wedding.testimony && (
          <Section title="Our Testimony">
            <Prose text={wedding.testimony} />
          </Section>
        )}

        {/* ── Covenant Statement ── */}
        {wedding.covenantStatement && (
          <Section title="Why We Chose a Covenant Ceremony">
            <Prose text={wedding.covenantStatement} />
          </Section>
        )}

        {/* ── Event Details ── */}
        {(wedding.venueName || wedding.ceremonyTime || wedding.dressCode) && (
          <Section title="The Wedding">
            <div className="grid sm:grid-cols-2 gap-6">
              {wedding.weddingDate && (
                <Detail label="Date" value={formatDate(wedding.weddingDate)} />
              )}
              {wedding.ceremonyTime && (
                <Detail label="Time" value={wedding.ceremonyTime} />
              )}
              {wedding.venueName && (
                <Detail
                  label="Venue"
                  value={[wedding.venueName, wedding.venueAddress, wedding.venueCity, wedding.venueState]
                    .filter(Boolean).join(', ')}
                />
              )}
              {wedding.dressCode && (
                <Detail label="Dress Code" value={wedding.dressCode} />
              )}
            </div>
          </Section>
        )}

        {/* ── Hotel Block ── */}
        {wedding.hotelName && (
          <Section title="Where to Stay">
            <div className="rounded-2xl border border-[#e8dcc8] bg-white p-6">
              <p className="font-serif text-lg font-semibold text-[#3b2f2f] mb-2">
                {wedding.hotelName}
              </p>
              {wedding.hotelDetails && (
                <p className="text-[#6b5344] text-sm leading-relaxed mb-4">
                  {wedding.hotelDetails}
                </p>
              )}
              {wedding.hotelUrl && (
                <a
                  href={wedding.hotelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-lg bg-[#3b2f2f] px-5 py-2 text-sm text-white hover:bg-[#5c4033] transition"
                >
                  Book Your Room →
                </a>
              )}
            </div>
          </Section>
        )}

        {/* ── Registry ── */}
        {registry.length > 0 && (
          <Section title="Registry">
            <div className="flex flex-wrap gap-4">
              {registry.map((r) => (
                <a
                  key={r.url}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-[#d4af6a] px-6 py-3 text-sm font-medium text-[#3b2f2f] hover:bg-[#d4af6a]/10 transition"
                >
                  {r.label} →
                </a>
              ))}
            </div>
          </Section>
        )}

        {/* ── RSVP ── */}
        {wedding.rsvpDeadline && (
          <Section title="RSVP">
            <div className="rounded-2xl border border-[#e8dcc8] bg-white p-6 text-center">
              <p className="text-[#6b5344] mb-1 text-sm">Please respond by</p>
              <p className="font-serif text-xl font-semibold text-[#3b2f2f]">
                {formatDate(wedding.rsvpDeadline)}
              </p>
            </div>
          </Section>
        )}

      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-[#e8dcc8] py-10 text-center text-sm text-[#a08060]">
        <a href="https://www.altarwed.com" className="font-serif text-[#3b2f2f] font-semibold hover:underline">
          AltarWed
        </a>
        <span className="mx-2">·</span>
        Faith-first wedding planning
      </footer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small reusable components
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#3b2f2f] mb-6 text-center">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Prose({ text }: { text: string }) {
  return (
    <div className="space-y-4">
      {text.split('\n').filter(Boolean).map((p, i) => (
        <p key={i} className="text-[#6b5344] leading-relaxed text-base sm:text-lg">
          {p}
        </p>
      ))}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e8dcc8] bg-white p-5">
      <p className="text-xs uppercase tracking-widest text-[#a08060] mb-1">{label}</p>
      <p className="font-medium text-[#3b2f2f]">{value}</p>
    </div>
  )
}
