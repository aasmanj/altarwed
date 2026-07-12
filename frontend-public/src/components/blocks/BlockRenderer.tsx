// BlockRenderer, dispatches each WeddingPageBlock to its per-type component.
// All card-type blocks (VENUE_CARD, HOTEL_CARD, REGISTRY_CARD, COUNTDOWN, RSVP_CTA,
// WEDDING_PARTY_GRID, PHOTO_ALBUM_GRID, VOWS_PREVIEW) read their primary data from
// the WeddingWebsite scalar fields rather than the block's contentJson, so the couple
// only maintains one source of truth for those fields.

import { Calendar, ExternalLink, Hotel, MapPin, Gift, type LucideIcon } from 'lucide-react'
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
  // When true (editor preview iframe only) data-driven cards that have no data
  // yet render a dashed "fill this in" placeholder instead of disappearing, so
  // couples can see the block exists and where to populate it. On the live
  // public page this stays false and empty cards render nothing for guests.
  preview?: boolean
}

export default function BlockRenderer({ block, wedding, partyMembers = [], photos = [], preview = false }: Props) {
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
    case 'SCRIPTURE': {
      const blockText = str(content.text)
      // The couple's pinned verse (scalar scriptureText) renders as a site-wide
      // banner in the wedding layout. Older sites were auto-seeded a HOME
      // SCRIPTURE block holding that same verse (backfill seeding is now removed),
      // which showed it twice. Suppress only that case: a HOME block matching the
      // pinned verse. Re-quoting the same verse on another tab (e.g. Story) is a
      // deliberate choice and is left untouched.
      const pinned = (wedding.scriptureText ?? '').trim()
      if (block.tab === 'HOME' && pinned && blockText.trim() === pinned) return null
      return (
        <ScriptureBlock
          reference={str(content.reference)}
          text={blockText}
          translation={str(content.translation, 'ESV')}
        />
      )
    }
    case 'DIVIDER':
      return <DividerBlock />
    case 'VENUE_CARD':
      // venueSlot in the block's contentJson selects which venue this card renders:
      // "RECEPTION" pulls the reception_* fields, anything else (incl. legacy blocks
      // with an empty {}) defaults to the ceremony venue.
      return (
        <VenueCardBlock
          wedding={wedding}
          preview={preview}
          slot={str(content.venueSlot) === 'RECEPTION' ? 'RECEPTION' : 'CEREMONY'}
        />
      )
    case 'HOTEL_CARD':
      return <HotelCardBlock wedding={wedding} preview={preview} />
    case 'REGISTRY_CARD': {
      const slot = num(content.slot, 1)
      const url   = slot === 1 ? wedding.registryUrl1   : slot === 2 ? wedding.registryUrl2   : wedding.registryUrl3
      const label = slot === 1 ? wedding.registryLabel1 : slot === 2 ? wedding.registryLabel2 : wedding.registryLabel3
      return <RegistryCardBlock url={url} label={label} preview={preview} />
    }
    case 'COUNTDOWN':
      return <CountdownBlock weddingDate={wedding.weddingDate} preview={preview} />
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
      // On the live public site (preview=false) an empty grid renders nothing rather
      // than the editor's "members will appear here" placeholder, matching the card blocks.
      if (members.length === 0 && !preview) return null
      return <WeddingPartyGridBlock members={members} wedding={wedding} side={side} />
    }
    case 'PHOTO_ALBUM_GRID':
      if (photos.length === 0 && !preview) return null
      return <PhotoAlbumGridBlock photos={photos} wedding={wedding} />
    case 'VOWS_PREVIEW':
      if (!wedding.partnerOneVows && !wedding.partnerTwoVows && !preview) return null
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
  if (!text.trim()) return null
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
        <figcaption className="px-4 py-2 text-xs text-[#8a6a4a] text-center bg-white">{caption}</figcaption>
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

// Dashed scaffold shown in the editor preview when a data-driven card has no
// data yet. Tells the couple the block exists and where to populate it.
function EmptyCardPlaceholder({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-[#e8dcc8] bg-[#fdfaf6] p-6 text-center">
      <Icon className="w-5 h-5 text-[#d4af6a] mx-auto mb-2" strokeWidth={1.5} />
      <p className="text-sm font-medium text-[#6b5344]">{title}</p>
      <p className="text-xs text-[#8a6a4a] mt-1">{hint}</p>
    </div>
  )
}

function VenueCardBlock({ wedding, preview = false, slot = 'CEREMONY' }: { wedding: WeddingWebsite; preview?: boolean; slot?: 'CEREMONY' | 'RECEPTION' }) {
  const isReception = slot === 'RECEPTION'
  // Pick the ceremony or reception scalar set. Reception has no photo or dress code
  // (those belong to the ceremony venue / the couple overall); its photo is deferred.
  const venueName = isReception ? wedding.receptionVenueName : wedding.venueName
  const venueAddress = isReception ? wedding.receptionVenueAddress : wedding.venueAddress
  const venueCity = isReception ? wedding.receptionVenueCity : wedding.venueCity
  const venueState = isReception ? wedding.receptionVenueState : wedding.venueState
  const time = isReception ? wedding.receptionTime : wedding.ceremonyTime
  const additionalInfo = isReception ? wedding.receptionVenueAdditionalInfo : wedding.venueAdditionalInfo
  const venuePhotoUrl = isReception ? null : wedding.venuePhotoUrl
  const dressCode = isReception ? null : wedding.dressCode
  // Card header. Reception always labels ("Reception" default). Ceremony labels only when
  // a reception venue also exists (so the pair reads symmetrically, matching the details
  // page); a lone ceremony venue stays unlabeled. Custom titles always win.
  const title = isReception
    ? (wedding.receptionVenueTitle || 'Reception')
    : (wedding.ceremonyVenueTitle || (wedding.receptionVenueName ? 'Ceremony' : null))
  const { weddingDate } = wedding

  if (!venueName) {
    return preview ? (
      <EmptyCardPlaceholder
        icon={MapPin}
        title={isReception ? 'Reception venue card' : 'Venue card'}
        hint={isReception
          ? 'Add your reception venue name, address, and time in the Event Details tab to fill this in.'
          : 'Add your venue name, address, time, and dress code in the Event Details tab to fill this in.'}
      />
    ) : null
  }
  const address = [venueAddress, venueCity, venueState].filter(Boolean).join(', ')
  return (
    <div className="rounded-xl border border-[#e8dcc8] bg-white overflow-hidden">
      {venuePhotoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={venuePhotoUrl}
          alt={venueName}
          className="w-full object-cover max-h-52"
        />
      )}
      <div className="p-6 space-y-3">
        {title && (
          <p className="text-xs uppercase tracking-[0.2em] text-[#8a6a4a]">{title}</p>
        )}
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-[#d4af6a] shrink-0 mt-0.5" strokeWidth={1.5} />
          <div>
            <p className="font-serif font-semibold text-[#3b2f2f] text-lg">{venueName}</p>
            {address && <p className="text-sm text-[#6b5344] mt-0.5">{address}</p>}
          </div>
        </div>
        {(weddingDate || time) && (
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-[#d4af6a] shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              {weddingDate && <p className="text-sm text-[#3b2f2f] font-medium">{formatWeddingDate(weddingDate)}</p>}
              {time && <p className="text-xs text-[#8a6a4a]">{time}</p>}
            </div>
          </div>
        )}
        {dressCode && (
          <p className="text-xs text-[#8a6a4a] pl-8">Dress code: <span className="font-medium text-[#6b5344]">{dressCode}</span></p>
        )}
        {additionalInfo && (
          <div className="border-t border-[#e8dcc8] pt-3 mt-1">
            <p className="text-sm text-[#6b5344] leading-relaxed whitespace-pre-line">{additionalInfo}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function HotelCardBlock({ wedding, preview = false }: { wedding: WeddingWebsite; preview?: boolean }) {
  const { hotelName, hotelUrl, hotelDetails } = wedding
  if (!hotelName) {
    return preview ? (
      <EmptyCardPlaceholder
        icon={Hotel}
        title="Hotel card"
        hint="Add a hotel block in the Travel tab to fill this in for out-of-town guests."
      />
    ) : null
  }
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

function RegistryCardBlock({ url, label, preview = false }: { url: string | null | undefined; label: string | null | undefined; preview?: boolean }) {
  if (!url) {
    return preview ? (
      <EmptyCardPlaceholder
        icon={Gift}
        title={label || 'Registry'}
        hint="Add a registry link in the Registry tab to fill this in."
      />
    ) : null
  }
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
        <p className="text-xs text-[#8a6a4a] mt-0.5 truncate max-w-[260px]">{url}</p>
      </div>
      <ExternalLink className="w-4 h-4 text-[#8a6a4a] ml-auto shrink-0" strokeWidth={1.5} />
    </a>
  )
}

function CountdownBlock({ weddingDate, preview = false }: { weddingDate: string | null; preview?: boolean }) {
  if (!weddingDate) {
    return preview ? (
      <EmptyCardPlaceholder
        icon={Calendar}
        title="Countdown"
        hint="Set your wedding date in the Event Details tab to start the countdown."
      />
    ) : null
  }
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
  ALL:   { border: 'border-[#e8dcc8]', role: 'text-[#8a6a4a]', bg: 'bg-white' },
} as const

function WeddingPartyGridBlock({ members, wedding, side }: {
  members: WeddingPartyMember[]
  wedding: WeddingWebsite
  side: 'BRIDE' | 'GROOM' | 'ALL'
}) {
  if (members.length === 0) {
    return (
      <p className="text-center text-[#8a6a4a] text-sm py-6 italic">
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
      <p className="text-center text-xs uppercase tracking-[0.2em] text-[#8a6a4a] mb-8">{label}</p>
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
                <span className="font-serif text-3xl text-[#8a6a4a]">{member.name.charAt(0)}</span>
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
      <p className="text-center text-[#8a6a4a] text-sm py-6 italic">
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
              <p className="text-xs text-[#8a6a4a] leading-relaxed">{photo.caption}</p>
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
      <p className="text-center text-[#8a6a4a] text-sm py-6 italic">
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
// A free-form "moment", optional date/label badge, body text, and an optional
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
        <div className={`flex gap-4 items-start flex-col ${imagePosition === 'left' ? 'sm:flex-row' : 'sm:flex-row-reverse'} sm:gap-5`}>
          {/* Photo, fixed width on sm+, full width on mobile */}
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
