import { notFound } from 'next/navigation'
import { getWedding } from '../data'

export default async function RegistryPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const wedding = await getWedding(slug)
  if (!wedding || !wedding.isPublished) notFound()

  const items = [
    { label: wedding.registryLabel1 ?? 'Registry', url: wedding.registryUrl1 },
    { label: wedding.registryLabel2 ?? 'Registry', url: wedding.registryUrl2 },
    { label: wedding.registryLabel3 ?? 'Registry', url: wedding.registryUrl3 },
  ].filter(r => r.url)

  return (
    <div className="space-y-10">
      <SectionHeading>Registry</SectionHeading>

      <p className="text-center text-[#6b5344] leading-relaxed max-w-md mx-auto">
        Your presence at our wedding is the greatest gift. If you&rsquo;d like to give more,
        here are our registries.
      </p>

      {items.length === 0 ? (
        <div className="text-center py-12 text-[#a08060]">
          <p className="font-serif text-xl">Registry coming soon…</p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center">
          {items.map(r => (
            <a
              key={r.url!}
              href={r.url!}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border border-[#d4af6a] bg-white px-10 py-5 text-sm font-semibold text-[#3b2f2f] hover:bg-[#d4af6a]/10 transition text-center min-w-[200px]"
            >
              {r.label} →
            </a>
          ))}
        </div>
      )}
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
