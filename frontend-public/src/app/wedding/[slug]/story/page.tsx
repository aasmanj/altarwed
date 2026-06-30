import { notFound } from 'next/navigation'
import { getWedding } from '@/app/wedding/[slug]/data'
import TabBlocks from '@/components/blocks/TabBlocks'

export default async function StoryPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const wedding = await getWedding(slug)
  if (!wedding) notFound()

  const fallback = wedding.ourStory ? (
    <div className="space-y-14">
      <SectionHeading>Our Story</SectionHeading>

      <div>
        <h3 className="text-xs uppercase tracking-[0.2em] text-[#d4af6a] mb-6">How we met</h3>
        <Prose text={wedding.ourStory} />
      </div>
    </div>
  ) : (
    <div className="text-center py-16 text-[#8a6a4a]">
      <p className="font-serif text-2xl mb-2">Our story is being written…</p>
      <p className="text-sm">Check back soon.</p>
    </div>
  )

  return <TabBlocks slug={slug} tab="OUR_STORY" wedding={wedding} fallback={fallback} />
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

function Prose({ text }: { text: string }) {
  return (
    <div className="space-y-4">
      {text.split('\n').filter(Boolean).map((p, i) => (
        <p key={i} className="text-[#6b5344] leading-relaxed text-base sm:text-lg">{p}</p>
      ))}
    </div>
  )
}
