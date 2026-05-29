// BlockRenderer — dispatches each WeddingPageBlock to its per-type component.
// All card-type blocks (VENUE_CARD, HOTEL_CARD, REGISTRY_CARD, COUNTDOWN, RSVP_CTA,
// WEDDING_PARTY_GRID, PHOTO_ALBUM_GRID, VOWS_PREVIEW) read their primary data from
// the WeddingWebsite scalar fields rather than the block's contentJson, so the couple
// only maintains one source of truth for those fields.

import { Calendar, ExternalLink, Hotel, MapPin, Gift } from 'lucide-react'
import type { WeddingWebsite, WeddingPageBlock } from '@/app/wedding/[slug]/data'
import { daysUntilDate, formatWeddingDate } from '@/lib/date'

// ── Auxiliary data passed by the preview page for dynamic blocks ──
export interface WeddingPartyMember {
  id: string
  name: string
  role: string
  side: 'BRIDE' | 'GROOM' | 'NEUTRAL'
  bio: string | null
  photoUrl: string | null
  sortOrder: number
}

export interface WeddingPhoto {
  id: string
  url: string
  caption: string | null
  sortOrder: number
}

interface Props {
  block: WeddingPageBlock
  wedding: WeddingWebsite
  partyMembers?: WeddingPartyMember[]
  photos?: WeddingPhoto[]
}

export default function BlockRenderer({ block, wedding, partyMembers = [], photos = [] }: Props) {
  const content = safeParseJson(block.contentJson)

  const str = (v: unknown, fallback = ''): string =>
    typeof v === 'string' ? v : fallback
  const num = (v: unknown, fallback = 0): number =>
    typeof v === 'number' ? v : fallback

  switch (block.type) {
    case 'TEXT':
      return <TextBlock markdown={str(content.markdown)} />
    case 'HEADING':
      return <HeadingBlock text={str(content.text)} level={num(content.level, 2)} />
    case 'IMAGE':
      return <ImageBlock url={str(content.url)} caption={str(content.caption)} alt={str(content.alt)} />
    case 'STORY_ENTRY':
      return (
        <StoryEntryBlock
          dateLabel={str(content.dateLabel)}
          body={str(content.body)}
          imageUrl={str(content.imageUrl)}
          imagePosition={(content.imagePosition === 'left' ? 'left' : 'right')}
        />
      )
    case 'SCRIPTURE':
      return (
        <ScriptureBlock
          reference={str(content.reference)}
          text={str(content.text)}
          translation={str(content.translation, 'ESV')}
        />
      )
    case 'DIVIDER':
      return <DividerBlock />
    case 'VENUE_CARD':
      return <VenueCardBlock wedding={wedding} />
    case 'HOTEL_CARD':
      return <HotelCardBlock wedding={wedding} />
    case 'REGISTRY_CARD': {
      const slot = num(content.slot, 1)
      const url   = slot === 1 ? wedding.registryUrl1   : slot === 2 ? wedding.registryUrl2   : wedding.registryUrl3
      const label = slot === 1 ? wedding.registryLabel1 : slot === 2 ? wedding.registryLabel2 : wedding.registryLabel3
      return <RegistryCardBlock url={url} label={label} />
    }
    case 'COUNTDOWN':
      return <CountdownBlock weddingDate={wedding.weddingDate} />
    case 'RSVP_CTA':
      return (
        <RsvpCtaBlock
          slug={wedding.slug}
          partnerOneName={wedding.partnerOneName}
          partnerTwoName={wedding.partnerTwoName}
          heading={str(content.heading)}
          buttonLabel={str(content.buttonLabel)}
        />
      )
    case 'WEDDING_PARTY_GRID': {
      const sideRaw = str(content.side, 'ALL')
      const side = (sideRaw === 'BRIDE' || sideRaw === 'GROOM') ? sideRaw : 'ALL'
      const members = side === 'ALL' ? partyMembers : partyMembers.filter(m => m.side === side)
      return <WeddingPartyGridBlock members={members} wedding={wedding} side={side} />
    }
    case 'PHOTO_ALBUM_GRID':
      return <PhotoAlbumGridBlock photos={photos} wedding={wedding} />
    case 'VOWS_PREVIEW':
      return (
        <VowsPreviewBlock
          partnerOneName={wedding.partnerOneName}
          partnerTwoName={wedding.partnerTwoName}
          partnerOneVows={wedding.partnerOneVows}
          partnerTwoVows={wedding.partnerTwoVows}
        />
      )
    default:
      return null
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeParseJson(json: string): Record<string, unknown> {
  try { return JSON.parse(json) } catch { return {} }
}

// ── Block sub-components ─────────────────────────────────────────────────────

function TextBlock({ markdown }: { markdown: string }) {
  // Simple renderer: split on double newline for paragraphs, preserve single newlines.
  if (!markdown.trim()) return null
  const paragraphs = markdown.split(/\n{2,}/)
  return (
    <div className="space-y-4">
      {paragraphs.map((p, i) => (
        <p key={i} className="text-[#3b2f2f] leading-relaxed text-base">
          {p.split('\n').map((line, j, arr) => (
            <span key={j}>
              {line}
              {j < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </div>
  )
}

function HeadingBlock({ text, level }: { text: string; level: number }) {
  const cls = 'font-serif text-[#3b2f2f] font-bold'
  if (level === 2) return <h2 className={`${cls} text-3xl sm:text-4xl`}>{text}</h2>
  if (level === 3) return <h3 className={`${cls} text-2xl sm:text-3xl`}>{text}</h3>
  return <h4 className={`${cls} text-xl sm:text-2xl`}>{text}</h4>
}

function ImageBlock({ url, caption, alt }: { url: string; caption: string; alt: string }) {
  if (!url) return null
  return (
    <figure className="rounded-2xl overflow-hidden shadow-sm border border-[#e8dcc8]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt || caption || 'Wedding photo'} className="w-full object-cover max-h-[480px]" />
      {caption && (
        <figcaption className="px-4 py-2 text-xs text-[#a08060] text-center bg-white">{caption}</figcaption>
      )}
    </figure>
  )
}

function ScriptureBlock({ reference, text, translation }: { reference: string; text: string; translation: string }) {
  if (!text && !reference) return null
  return (
    <div className="rounded-2xl bg-gradient-to-b from-[#3b2f2f] to-[#4a1942] py-10 px-8 text-center relative">
      <div className="absolute inset-x-0 top-0 h-px bg-[#d4af6a]/40" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-[#d4af6a]/40" />
      {text && (
        <blockquote className="font-serif italic text-[#fdfaf6] text-xl sm:text-2xl max-w-2xl mx-auto leading-relaxed">
          &ldquo;{text}&rdquo;
        </blockquote>
      )}
      {reference && (
        <p className="mt-5 text-[#d4af6a] text-sm tracking-[0.25em] uppercase font-medium">
          {reference}
          {translation && <span className="text-white/40 ml-2 normal-case tracking-normal">({translation})</span>}
        </p>
      )}
    </div>
  )
}

function DividerBlock() {
  return (
    <div className="flex items-center justify-center gap-4 py-2">
      <div className="h-px flex-1 bg-[#d4af6a]/30" />
      <div className="h-2 w-2 rounded-full bg-[#d4af6a]/60" />
      <div className="h-px flex-1 bg-[#d4af6a]/30" />
    </div>
  )
}

function VenueCardBlock({ wedding }: { wedding: WeddingWebsite }) {
  const { venueName, venueAddress, venueCity, venueState, ceremonyTime, weddingDate, dressCode } = wedding
  if (!venueName) return null
  const address = [venueAddress, venueCity, venueState].filter(Boolean).join(', ')
  return (
    <div className="rounded-xl border border-[#e8dcc8] bg-white p-6 space-y-3">
      <div className="flex items-start gap-3">
        <MapPin className="w-5 h-5 text-[#d4af6a] shrink-0 mt-0.5" strokeWidth={1.5} />
        <div>
          <p className="font-serif font-semibold text-[#3b2f2f] text-lg">{venueName}</p>
          {address && <p className="text-sm text-[#6b5344] mt-0.5">{address}</p>}
        </div>
      </div>
      {(weddingDate || ceremonyTime) && (
        <div className="flex items-start gap-3">
          <Calendar className="w-5 h-5 text-[#d4af6a] shrink-0 mt-0.5" strokeWidth={1.5} />
          <div>
            {weddingDate && <p className="text-sm text-[#3b2f2f] font-medium">{formatWeddingDate(weddingDate)}</p>}
            {ceremonyTime && <p className="text-xs text-[#a08060]">{ceremonyTime}</p>}
          </div>
        </div>
      )}
      {dressCode && (
        <p className="text-xs text-[#a08060] pl-8">Dress code: <span className="font-medium text-[#6b5344]">{dressCode}</span></p>
      )}
    </div>
  )
}

function HotelCardBlock({ wedding }: { wedding: WeddingWebsite }) {
  const { hotelName, hotelUrl, hotelDetails } = wedding
  if (!hotelName) return null
  return (
    <div className="rounded-xl border border-[#e8dcc8] bg-white p-6 space-y-3">
      <div className="flex items-start gap-3">
        <Hotel className="w-5 h-5 text-[#d4af6a] shrink-0 mt-0.5" strokeWidth={1.5} />
        <div>
          <p className="font-serif font-semibold text-[#3b2f2f] text-lg">{hotelName}</p>
          {hotelDetails && <p className="text-sm text-[#6b5344] mt-1 leading-relaxed">{hotelDetails}</p>}
        </div>
      </div>
      {hotelUrl && (
        <a
          href={hotelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-[#d4af6a] hover:underline pl-8"
        >
          Book a room <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
        </a>
      )}
    </div>
  )
}

function RegistryCardBlock({ url, label }: { url: string | null | undefined; label: string | null | undefined }) {
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-4 rounded-xl border border-[#e8dcc8] bg-white p-5 hover:border-[#d4af6a] hover:shadow-sm transition group"
    >
      <Gift className="w-6 h-6 text-[#d4af6a] shrink-0" strokeWidth={1.5} />
      <div>
        <p className="font-medium text-[#3b2f2f] group-hover:underline">{label ?? 'Registry'}</p>
        <p className="text-xs text-[#a08060] mt-0.5 truncate max-w-[260px]">{url}</p>
      </div>
      <ExternalLink className="w-4 h-4 text-[#a08060] ml-auto shrink-0" strokeWidth={1.5} />
    </a>
  )
}

function CountdownBlock({ weddingDate }: { weddingDate: string | null }) {
  if (!weddingDate) return null
  const countdown = daysUntilDate(weddingDate)
  if (countdown > 0) {
    return (
      <div className="rounded-2xl bg-[#3b2f2f] text-white text-center py-10 px-6">
        <p className="text-xs uppercase tracking-[0.3em] text-[#d4af6a]/80 mb-2">Counting down</p>
        <p className="font-serif text-7xl font-bold text-[#d4af6a]">{countdown}</p>
        <p className="mt-1 text-white/70 text-sm uppercase tracking-widest">days</p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl bg-[#3b2f2f] text-white text-center py-10 px-6">
      <p className="font-serif text-3xl font-bold text-[#d4af6a]">We&rsquo;re married!</p>
      <p className="mt-2 text-white/70 text-sm">Thank you for being part of our covenant celebration.</p>
    </div>
  )
}

function RsvpCtaBlock({ slug, partnerOneName, partnerTwoName, heading, buttonLabel }: {
  slug: string
  partnerOneName: string
  partnerTwoName: string
  heading?: string
  buttonLabel?: string
}) {
  const displayHeading = heading || `Will you join ${partnerTwoName} & ${partnerOneName}?`
  const displayButton  = buttonLabel || 'RSVP now'
  return (
    <div className="rounded-2xl bg-[#fdf3e3] border border-[#e8dcc8] px-8 py-10 text-center">
      <p className="font-serif text-2xl font-bold text-[#3b2f2f] mb-2">
        {displayHeading}
      </p>
      <p className="text-sm text-[#6b5344] mb-6">
        Let us know you&rsquo;ll be there to celebrate our covenant.
      </p>
      <a
        href={`/wedding/${slug}/rsvp`}
        className="inline-block px-8 py-3 rounded-full bg-[#3b2f2f] text-white text-sm font-medium hover:bg-[#4a3b3b] transition"
      >
        {displayButton}
      </a>
    </div>
  )
}

const PARTY_ACCENTS = {
  BRIDE: { border: 'border-rose-200', role: 'text-rose-500', bg: 'bg-rose-50/40' },
  GROOM: { border: 'border-sky-200',  role: 'text-sky-600',  bg: 'bg-sky-50/40' },
  ALL:   { border: 'border-[#e8dcc8]', role: 'text-[#a08060]', bg: 'bg-white' },
} as const

function WeddingPartyGridBlock({ members, wedding, side }: {
  members: WeddingPartyMember[]
  wedding: WeddingWebsite
  side: 'BRIDE' | 'GROOM' | 'ALL'
}) {
  if (members.length === 0) {
    return (
      <p className="text-center text-[#a08060] text-sm py-6 italic">
        Wedding party members will appear here.
      </p>
    )
  }
  const a = PARTY_ACCENTS[side]
  const label = side === 'BRIDE' ? `${wedding.partnerTwoName}'s side`
               : side === 'GROOM' ? `${wedding.partnerOneName}'s side`
               : 'Wedding Party'
  return (
    <div className={`${a.bg} rounded-2xl p-6`}>
      <p className="text-center text-xs uppercase tracking-[0.2em] text-[#a08060] mb-8">{label}</p>
      <div className="flex flex-wrap justify-center gap-6">
        {members.map(member => (
          <div key={member.id} className="text-center w-[130px]">
            {member.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={member.photoUrl}
                alt={member.name}
                className={`h-24 w-24 rounded-full object-cover mx-auto mb-3 border-2 ${a.border} shadow-sm`}
              />
            ) : (
              <div className={`h-24 w-24 rounded-full bg-white border-2 ${a.border} flex items-center justify-center mx-auto mb-3`}>
                <span className="font-serif text-3xl text-[#a08060]">{member.name.charAt(0)}</span>
              </div>
            )}
            <p className="font-serif font-semibold text-[#3b2f2f] text-sm leading-snug">{member.name}</p>
            <p className={`text-xs font-medium mt-0.5 uppercase tracking-wide ${a.role}`}>{member.role}</p>
            {member.bio && (
              <p className="text-xs text-[#6b5344] mt-1.5 leading-relaxed">{member.bio}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function PhotoAlbumGridBlock({ photos, wedding }: { photos: WeddingPhoto[]; wedding: WeddingWebsite }) {
  if (photos.length === 0) {
    return (
      <p className="text-center text-[#a08060] text-sm py-6 italic">
        Photos will appear here once {wedding.partnerTwoName} &amp; {wedding.partnerOneName} share them.
      </p>
    )
  }
  return (
    <div className="columns-2 sm:columns-3 gap-3 space-y-3">
      {photos.map(photo => (
        <div key={photo.id} className="break-inside-avoid rounded-xl overflow-hidden shadow-sm border border-[#e8dcc8]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={photo.caption ?? `${wedding.partnerTwoName} and ${wedding.partnerOneName}`}
            className="w-full object-cover"
          />
          {photo.caption && (
            <div className="px-3 py-2 bg-white">
              <p className="text-xs text-[#a08060] leading-relaxed">{photo.caption}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function VowsPreviewBlock({ partnerOneName, partnerTwoName, partnerOneVows, partnerTwoVows }: {
  partnerOneName: string
  partnerTwoName: string
  partnerOneVows: string | null
  partnerTwoVows: string | null
}) {
  if (!partnerOneVows && !partnerTwoVows) {
    return (
      <p className="text-center text-[#a08060] text-sm py-6 italic">
        Vows will appear here once written.
      </p>
    )
  }
  // Bride-first display order: partnerTwoName (Bride) renders left, partnerOneName (Groom) renders right.
  return (
    <div className="grid sm:grid-cols-2 gap-6">
      {partnerTwoVows && (
        <VowCard name={partnerTwoName} vows={partnerTwoVows} />
      )}
      {partnerOneVows && (
        <VowCard name={partnerOneName} vows={partnerOneVows} />
      )}
    </div>
  )
}

function VowCard({ name, vows }: { name: string; vows: string }) {
  return (
    <div className="rounded-2xl bg-white border border-[#e8dcc8] p-6">
      <p className="font-serif text-lg font-semibold text-[#3b2f2f] mb-3">{name}</p>
      <div className="absolute inset-x-6 h-px bg-[#d4af6a]/30" />
      <p className="text-sm text-[#3b2f2f] leading-relaxed whitespace-pre-wrap">{vows}</p>
    </div>
  )
}

// ── StoryEntryBlock ───────────────────────────────────────────────────────────
// A free-form "moment" — optional date/label badge, body text, and an optional
// photo that sits to the left or right of the text. No forced date picker;
// the couple writes whatever they want in dateLabel (a date, a place, a caption).
function StoryEntryBlock({
  dateLabel,
  body,
  imageUrl,
  imagePosition,
}: {
  dateLabel: string
  body: string
  imageUrl: string
  imagePosition: 'left' | 'right'
}) {
  const hasImage = !!imageUrl
  const hasContent = !!body.trim()
  if (!hasContent && !hasImage && !dateLabel) return null

  return (
    <div className="space-y-3">
      {/* Date / label badge */}
      {dateLabel && (
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af6a]">
          {dateLabel}
        </p>
      )}

      {/* Body + image side by side when both present */}
      {hasImage ? (
        <div className={`flex gap-5 items-start ${imagePosition === 'left' ? 'flex-row' : 'flex-row-reverse'}`}>
          {/* Photo — fixed width on md+, full width below */}
          <div className="w-full sm:w-2/5 flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={dateLabel || 'Story photo'}
              className="w-full rounded-xl object-cover shadow-sm border border-[#e8dcc8]"
              style={{ maxHeight: '320px' }}
            />
          </div>

          {/* Text */}
          {hasContent && (
            <div className="flex-1 min-w-0">
              <TextBlock markdown={body} />
            </div>
          )}
        </div>
      ) : (
        hasContent && <TextBlock markdown={body} />
      )}
    </div>
  )
}
