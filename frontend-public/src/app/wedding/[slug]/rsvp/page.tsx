import { getPublishedWedding } from '@/app/wedding/[slug]/data'
import { formatWeddingDate } from '@/lib/date'
import FindInvitationWidget from './FindInvitationWidget'
import ViralCtaLink from '@/components/ViralCtaLink'

export default async function RsvpTabPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  // Unpublished draft: render nothing; the layout shows ComingSoon (see data.ts).
  const wedding = await getPublishedWedding(slug)
  if (!wedding) return null

  return (
    <div className="space-y-10">
      <SectionHeading>RSVP</SectionHeading>

      <div className="rounded-2xl border-2 border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] p-6 sm:p-10 space-y-8">
        {/* Heading row */}
        <div className="text-center">
          <p className="font-serif text-2xl sm:text-3xl font-bold text-[#3b2f2f] mb-2">Will you join us?</p>
          {wedding.rsvpDeadline && (
            <p className="text-sm text-[#8a6a4a]">
              Please RSVP by {formatWeddingDate(wedding.rsvpDeadline)}
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[color-mix(in_srgb,var(--accent)_30%,transparent)]" />
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          <div className="h-px flex-1 bg-[color-mix(in_srgb,var(--accent)_30%,transparent)]" />
        </div>

        {/* Search section */}
        <div className="space-y-4">
          <div className="text-center">
            <p className="font-medium text-[#3b2f2f]">Find your invitation</p>
            <p className="mt-1 text-sm text-[#6b5344]">
              Type your name below to look up your personal RSVP link.
            </p>
          </div>

          <FindInvitationWidget slug={slug} />
        </div>

        {/* Fallback note */}
        <p className="text-center text-xs text-[#8a6a4a]">
          You can also check your email for your personal invitation link sent by{' '}
          {wedding.partnerTwoName} &amp; {wedding.partnerOneName}.
        </p>
      </div>

      {/* Discreet viral affordance on the RSVP entry, the highest-traffic guest
          surface on a couple's site. Kept small and visually secondary (a quiet
          centered line, not a button) so it never cheapens the couple's page; the
          site footer carries the fuller CTA. Distinct utm_campaign=rsvp-entry so
          this surface is measured on its own, and the Meta Pixel Lead event is
          consent-gated inside ViralCtaLink. Same muted brown as the sibling note
          above (underline gives a non-color signal for the link). */}
      <p className="text-center text-xs text-[#8a6a4a]">
        Created on AltarWed.{' '}
        <ViralCtaLink
          href="https://app.altarwed.com/register?utm_source=wedding-site&utm_medium=referral&utm_campaign=rsvp-entry"
          source="rsvp-entry"
          className="underline hover:text-[#3b2f2f] transition"
        >
          Make your own Christian wedding website for free
        </ViralCtaLink>
      </p>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center">
      <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#3b2f2f]">{children}</h2>
      <div className="mt-3 flex items-center justify-center gap-3">
        <div className="h-px w-10 bg-[color-mix(in_srgb,var(--accent)_40%,transparent)]" />
        <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
        <div className="h-px w-10 bg-[color-mix(in_srgb,var(--accent)_40%,transparent)]" />
      </div>
    </div>
  )
}
