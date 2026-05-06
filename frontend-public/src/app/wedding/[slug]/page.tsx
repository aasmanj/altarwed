import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import PrayerWallSection from './PrayerWallSection'
import WeddingNav from './WeddingNav'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RegistryItem { label: string; url: string }

interface WeddingPartyMember {
  id: string
  name: string
  role: string
  side: 'BRIDE' | 'GROOM' | 'NEUTRAL'
  bio: string | null
  photoUrl: string | null
  sortOrder: number
}

interface Prayer {
  id: string
  guestName: string
  prayerText: string
  createdAt: string
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
    const res = await fetch(`${apiUrl}/api/v1/wedding-websites/slug/${slug}`, { next: { revalidate: 60 } })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`API error ${res.status}`)
    return res.json()
  } catch {
    return null
  }
}

async function getWeddingParty(websiteId: string, apiUrl: string): Promise<WeddingPartyMember[]> {
  try {
    const res = await fetch(`${apiUrl}/api/v1/wedding-party/website/${websiteId}`, { next: { revalidate: 60 } })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

async function getPrayers(slug: string, apiUrl: string): Promise<Prayer[]> {
  try {
    const res = await fetch(`${apiUrl}/api/v1/prayers/website/${slug}`, { next: { revalidate: 30 } })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Metadata
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
      title, description, type: 'website',
      url: `https://www.altarwed.com/wedding/${slug}`,
      images: [{ url: image, width: 1200, height: 800, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function daysUntil(iso: string) {
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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'
  const wedding = await getWedding(slug)
  if (!wedding || !wedding.isPublished) notFound()

  const heroImage = wedding.heroPhotoUrl
    ?? 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1600&q=80'
  const countdown = wedding.weddingDate ? daysUntil(wedding.weddingDate) : null
  const registry = registryLinks(wedding)

  const [weddingParty, prayers] = await Promise.all([
    getWeddingParty(wedding.id, apiUrl),
    getPrayers(slug, apiUrl),
  ])

  const neutralParty = weddingParty.filter(m => m.side === 'NEUTRAL')
  const brideParty   = weddingParty.filter(m => m.side === 'BRIDE')
  const groomParty   = weddingParty.filter(m => m.side === 'GROOM')

  // Determine which tabs to show based on available content
  const hasStory    = !!(wedding.ourStory || wedding.testimony || wedding.covenantStatement)
  const hasDetails  = !!(wedding.venueName || wedding.ceremonyTime || wedding.dressCode)
  const hasParty    = weddingParty.length > 0
  const hasRegistry = registry.length > 0
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
        {/* Gradient from bottom */}
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
            <p className="mt-2 text-[#d4af6a] text-sm tracking-widest uppercase">Married! 🎉</p>
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
        hasStory={hasStory}
        hasDetails={hasDetails}
        hasParty={hasParty}
        hasRegistry={hasRegistry}
        hasTravel={hasTravel}
      />

      {/* ── Content sections ── */}
      <div className="max-w-3xl mx-auto px-6 py-14 space-y-24">

        {/* Our Story */}
        {hasStory && (
          <section id="story">
            <SectionHeading>Our Story</SectionHeading>
            <div className="space-y-10">
              {wedding.ourStory && (
                <div>
                  <h3 className="text-xs uppercase tracking-[0.2em] text-[#d4af6a] mb-4">How we met</h3>
                  <Prose text={wedding.ourStory} />
                </div>
              )}
              {wedding.testimony && (
                <div>
                  <h3 className="text-xs uppercase tracking-[0.2em] text-[#d4af6a] mb-4">Our testimony</h3>
                  <Prose text={wedding.testimony} />
                </div>
              )}
              {wedding.covenantStatement && (
                <div>
                  <h3 className="text-xs uppercase tracking-[0.2em] text-[#d4af6a] mb-4">Why we chose a covenant ceremony</h3>
                  <Prose text={wedding.covenantStatement} />
                </div>
              )}
            </div>
          </section>
        )}

        {/* Details */}
        {hasDetails && (
          <section id="details">
            <SectionHeading>The Wedding</SectionHeading>
            <div className="grid sm:grid-cols-2 gap-4">
              {wedding.weddingDate && (
                <DetailCard label="Date" value={formatDate(wedding.weddingDate)} icon="📅" />
              )}
              {wedding.ceremonyTime && (
                <DetailCard label="Time" value={wedding.ceremonyTime} icon="🕐" />
              )}
              {wedding.venueName && (
                <DetailCard
                  label="Venue"
                  value={[wedding.venueName, wedding.venueAddress, wedding.venueCity, wedding.venueState].filter(Boolean).join(', ')}
                  icon="📍"
                />
              )}
              {wedding.dressCode && (
                <DetailCard label="Dress Code" value={wedding.dressCode} icon="👗" />
              )}
            </div>
            {wedding.rsvpDeadline && (
              <div className="mt-6 rounded-2xl bg-[#3b2f2f] text-white px-8 py-6 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-[#d4af6a] mb-1">RSVP by</p>
                <p className="font-serif text-2xl font-bold">{formatDate(wedding.rsvpDeadline)}</p>
              </div>
            )}
          </section>
        )}

        {/* Wedding Party */}
        {hasParty && (
          <section id="party">
            <SectionHeading>Wedding Party</SectionHeading>
            <div className="space-y-12">
              {neutralParty.length > 0 && (
                <PartyGroup label="Ceremony" members={neutralParty} />
              )}
              {brideParty.length > 0 && (
                <PartyGroup label={`${wedding.partnerTwoName}'s side`} members={brideParty} />
              )}
              {groomParty.length > 0 && (
                <PartyGroup label={`${wedding.partnerOneName}'s side`} members={groomParty} />
              )}
            </div>
          </section>
        )}

        {/* Registry */}
        {hasRegistry && (
          <section id="registry">
            <SectionHeading>Registry</SectionHeading>
            <p className="text-center text-[#6b5344] text-sm mb-8">
              Your presence is the greatest gift. If you&rsquo;d like to give more, here are our registries.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              {registry.map(r => (
                <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer"
                  className="rounded-2xl border border-[#d4af6a] bg-white px-8 py-4 text-sm font-semibold text-[#3b2f2f] hover:bg-[#d4af6a]/10 transition min-w-[160px] text-center">
                  {r.label} →
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Travel */}
        {hasTravel && (
          <section id="travel">
            <SectionHeading>Where to Stay</SectionHeading>
            <div className="rounded-2xl border border-[#e8dcc8] bg-white p-8">
              <div className="flex items-start gap-4">
                <div className="text-3xl">🏨</div>
                <div className="flex-1">
                  <p className="font-serif text-xl font-semibold text-[#3b2f2f] mb-2">{wedding.hotelName}</p>
                  {wedding.hotelDetails && (
                    <p className="text-[#6b5344] text-sm leading-relaxed mb-4">{wedding.hotelDetails}</p>
                  )}
                  {wedding.hotelUrl && (
                    <a href={wedding.hotelUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-block rounded-lg bg-[#3b2f2f] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5c4033] transition">
                      Book your room →
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Prayer Wall */}
        <section id="prayer">
          <PrayerWallSection slug={slug} initialPrayers={prayers} apiUrl={apiUrl} />
        </section>

      </div>

      {/* Footer */}
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
// Components
// ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center mb-10">
      <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#3b2f2f]">{children}</h2>
      <div className="mt-3 flex items-center justify-center gap-3">
        <div className="h-px w-10 bg-[#d4af6a]/40" />
        <div className="h-1.5 w-1.5 rounded-full bg-[#d4af6a]" />
        <div className="h-px w-10 bg-[#d4af6a]/40" />
      </div>
    </div>
  )
}

function Prose({ text }: { text: string }) {
  return (
    <div className="space-y-4">
      {text.split('\n').filter(Boolean).map((p, i) => (
        <p key={i} className="text-[#6b5344] leading-relaxed text-base sm:text-lg">{p}</p>
      ))}
    </div>
  )
}

function DetailCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-xl border border-[#e8dcc8] bg-white p-5 flex gap-4 items-start">
      <span className="text-xl mt-0.5">{icon}</span>
      <div>
        <p className="text-xs uppercase tracking-widest text-[#a08060] mb-1">{label}</p>
        <p className="font-medium text-[#3b2f2f] text-sm leading-snug">{value}</p>
      </div>
    </div>
  )
}

function PartyGroup({ label, members }: { label: string; members: WeddingPartyMember[] }) {
  return (
    <div>
      <h3 className="text-center text-xs uppercase tracking-[0.2em] text-[#a08060] mb-8">{label}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
        {members.map(member => (
          <div key={member.id} className="text-center">
            {member.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={member.photoUrl}
                alt={member.name}
                className="h-24 w-24 rounded-full object-cover mx-auto mb-4 border-2 border-[#e8dcc8] shadow-sm"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-[#f5ede0] border-2 border-[#e8dcc8] flex items-center justify-center mx-auto mb-4">
                <span className="font-serif text-3xl text-[#a08060]">{member.name.charAt(0)}</span>
              </div>
            )}
            <p className="font-serif font-semibold text-[#3b2f2f] text-sm leading-snug">{member.name}</p>
            <p className="text-xs text-[#d4af6a] font-medium mt-0.5 uppercase tracking-wide">{member.role}</p>
            {member.bio && (
              <p className="text-xs text-[#6b5344] mt-2 leading-relaxed line-clamp-3">{member.bio}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
