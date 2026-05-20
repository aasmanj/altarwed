import { notFound } from 'next/navigation'
import { getWedding } from '@/app/wedding/[slug]/data'
import { formatWeddingDate } from '@/lib/date'

export default async function RsvpTabPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const wedding = await getWedding(slug)
  if (!wedding || !wedding.isPublished) notFound()

  return (
    <div className="space-y-10">
      <SectionHeading>RSVP</SectionHeading>

      <div className="rounded-2xl border-2 border-[#d4af6a] bg-[#d4af6a]/5 p-10 text-center">
        <p className="font-serif text-3xl font-bold text-[#3b2f2f] mb-3">Will you join us?</p>
        {wedding.rsvpDeadline && (
          <p className="text-sm text-[#a08060] mb-6">
            Please RSVP by {formatWeddingDate(wedding.rsvpDeadline)}
          </p>
        )}
        <p className="text-[#6b5344] mb-6 max-w-md mx-auto">
          Check your email for your personal RSVP invitation link. Each invite is unique to your party.
        </p>
        <p className="text-xs text-[#a08060]">
          Didn&apos;t receive an invite? Reach out to {wedding.partnerOneName} or {wedding.partnerTwoName} directly.
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
