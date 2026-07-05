import type { Metadata } from 'next'
import RsvpForm from './RsvpForm'
import { API, getRsvpData } from './getRsvpData'

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> }
): Promise<Metadata> {
  const { token } = await params
  const result = await getRsvpData(token)
  if (result.status !== 'ok') return { title: 'RSVP | AltarWed', robots: { index: false } }
  const data = result.data
  return {
    title: `RSVP to ${data.coupleNames}'s Wedding | AltarWed`,
    description: `${data.guestName}, you're invited to celebrate ${data.coupleNames}${data.weddingDate ? ` on ${data.weddingDate}` : ''}.`,
    // RSVP pages are personal token-gated links. They should never appear in search
    // results, each URL is unique to one guest and has no SEO value.
    robots: { index: false, follow: false },
  }
}

export default async function RsvpPage(
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const result = await getRsvpData(token)

  // Transient backend problem (5xx, timeout, network). Never tell a guest with a
  // valid token that their invite is dead over a brief hiccup or cold start.
  if (result.status === 'unavailable') {
    return (
      <div className="min-h-screen bg-[#fdfaf6] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="font-serif text-2xl font-bold text-[#3b2f2f]">
            We&apos;re having trouble loading your invitation
          </h1>
          <p className="text-[#6b5344]">
            This is a temporary problem on our end, not a problem with your invite. Please refresh
            the page or try again in a few moments.
          </p>
        </div>
      </div>
    )
  }

  // Genuinely invalid or expired token (400/404). This is terminal.
  if (result.status === 'invalid') {
    return (
      <div className="min-h-screen bg-[#fdfaf6] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="font-serif text-2xl font-bold text-[#3b2f2f]">This link has expired</h1>
          <p className="text-[#6b5344]">
            This RSVP link is no longer valid. Please contact the couple directly for a new invite.
          </p>
          {/* Working recovery path: the finder searches by name and mints a fresh RSVP
              link, so a guest with a used or stale link is not stuck. We have no slug
              on a dead token, so send them to the name-search entry point. */}
          <p className="text-[#6b5344]">
            You can also{' '}
            <a href="/find-wedding" className="font-medium text-[#4a1942] underline hover:text-[#3b1235]">
              find your invitation
            </a>{' '}
            by searching for the couple&apos;s wedding by name.
          </p>
        </div>
      </div>
    )
  }

  const data = result.data

  const venue = [data.venueName, data.venueCity, data.venueState].filter(Boolean).join(', ')

  return (
    <div className="min-h-screen bg-[#fdfaf6] font-sans text-[#3b2f2f]">
      {/* Header */}
      <div className="bg-[#3b2f2f] py-12 px-6 text-center">
        <p className="text-[#d4af6a] text-xs uppercase tracking-widest mb-3">You&apos;re invited</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-2">
          {data.coupleNames}
        </h1>
        {data.weddingDate && (
          <p className="text-white/80 text-sm mt-2">{data.weddingDate}</p>
        )}
        {venue && (
          <p className="text-white/60 text-sm mt-1">{venue}</p>
        )}
      </div>

      {/* RSVP card */}
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-[#e8dcc8] shadow-sm p-6 sm:p-8">
          <p className="text-[#6b5344] mb-6 text-center">
            {data.partyName
              ? <>Dear <strong className="text-[#3b2f2f]">{data.partyName}</strong>, please let us know if you&apos;ll be joining us.</>
              : <>Dear <strong className="text-[#3b2f2f]">{data.guestName}</strong>, please let us know if you&apos;ll be joining us.</>
            }
          </p>
          <RsvpForm
            token={token}
            plusOneAllowed={data.plusOneAllowed}
            weddingSlug={data.weddingSlug}
            hasRegistry={data.hasRegistry}
            apiUrl={API}
            partyMembers={data.partyMembers ?? undefined}
            currentRsvpStatus={data.currentRsvpStatus ?? undefined}
            currentPlusOneName={data.currentPlusOneName ?? undefined}
            currentDietary={data.currentDietary ?? undefined}
            currentSongRequest={data.currentSongRequest ?? undefined}
            currentNoteForCouple={data.currentNoteForCouple ?? undefined}
            customQuestions={data.customQuestions ?? undefined}
          />
        </div>

        {/* Privacy notice on the submit surface. The RSVP form collects details the
            guest shares with the couple (including dietary notes), so disclose it once
            here and link to the policy. #6b5344 on the cream page background clears
            WCAG AA 4.5:1 for this small footnote. */}
        <p className="mt-4 text-center text-xs text-[#6b5344]">
          Your responses are shared with the couple. See{' '}
          <a href="/privacy" className="font-medium text-[#4a1942] underline hover:text-[#3b1235]">
            how AltarWed handles your information
          </a>
          .
        </p>
      </div>

      {/* Viral CTA. A guest on a token RSVP link is the highest-intent free lead the
          platform gets (many are engaged themselves), so replace the bare attribution
          footer with the same create-your-own block the wedding footer and ComingSoon
          carry. Distinct utm_campaign=rsvp-thankyou keeps this surface measurable and
          separate from the wedding-footer (viral-footer) attribution. Kept compact here
          because the post-submit done state carries its own CTA, so the two should not
          both shout on the confirmation screen. */}
      <footer className="border-t border-[#e8dcc8] py-10 px-6 text-center text-sm text-[#8a6a4a] space-y-3">
        <p className="text-xs uppercase tracking-widest text-[#c4a882] font-medium">
          Created on AltarWed
        </p>
        <p className="text-[#6b5344]">
          Getting married too? Create your Christian wedding website for free.
        </p>
        <a
          href="https://app.altarwed.com/register?utm_source=wedding-site&utm_medium=referral&utm_campaign=rsvp-thankyou"
          className="inline-block px-6 py-2.5 rounded-full bg-[#3b2f2f] text-white text-xs font-semibold hover:bg-[#5c4033] transition"
        >
          Start for free →
        </a>
      </footer>
    </div>
  )
}
