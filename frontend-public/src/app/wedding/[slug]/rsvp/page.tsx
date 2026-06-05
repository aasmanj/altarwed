import { notFound } from 'next/navigation'
import { getWedding } from '@/app/wedding/[slug]/data'
import { formatWeddingDate } from '@/lib/date'
import FindInvitationWidget from './FindInvitationWidget'

export default async function RsvpTabPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const wedding = await getWedding(slug)
  if (!wedding) notFound()

  return (
    <div className="space-y-10">
      <SectionHeading>RSVP</SectionHeading>

      <div className="rounded-2xl border-2 border-[#d4af6a] bg-[#d4af6a]/5 p-8 sm:p-10 space-y-8">
        {/* Heading row */}
        <div className="text-center">
          <p className="font-serif text-3xl font-bold text-[#3b2f2f] mb-2">Will you join us?</p>
          {wedding.rsvpDeadline && (
            <p className="text-sm text-[#a08060]">
              Please RSVP by {formatWeddingDate(wedding.rsvpDeadline)}
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[#d4af6a]/30" />
          <div className="h-1.5 w-1.5 rounded-full bg-[#d4af6a]" />
          <div className="h-px flex-1 bg-[#d4af6a]/30" />
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
        <p className="text-center text-xs text-[#a08060]">
          You can also check your email for your personal invitation link sent by{' '}
          {wedding.partnerTwoName} &amp; {wedding.partnerOneName}.
        </p>
      </div>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center">
      <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#3b2f2f]">{children}</h2>
      <div className="mt-3 flex items-center justify-center gap-3">
        <div className="h-px w-10 bg-[#d4af6a]/40" />
        <div className="h-1.5 w-1.5 rounded-full bg-[#d4af6a]" />
        <div className="h-px w-10 bg-[#d4af6a]/40" />
      </div>
    </div>
  )
}
