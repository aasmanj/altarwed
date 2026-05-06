import { notFound } from 'next/navigation'
import { getWedding } from '../data'

interface WeddingPartyMember {
  id: string
  name: string
  role: string
  side: 'BRIDE' | 'GROOM' | 'NEUTRAL'
  bio: string | null
  photoUrl: string | null
  sortOrder: number
}

async function getWeddingParty(websiteId: string): Promise<WeddingPartyMember[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'
  try {
    const res = await fetch(`${apiUrl}/api/v1/wedding-party/website/${websiteId}`, { next: { revalidate: 60 } })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function WeddingPartyPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const wedding = await getWedding(slug)
  if (!wedding || !wedding.isPublished) notFound()

  const party = await getWeddingParty(wedding.id)
  const neutral = party.filter(m => m.side === 'NEUTRAL')
  const bride   = party.filter(m => m.side === 'BRIDE')
  const groom   = party.filter(m => m.side === 'GROOM')

  if (party.length === 0) {
    return (
      <div className="text-center py-16 text-[#a08060]">
        <p className="font-serif text-2xl mb-2">Wedding party coming soon…</p>
        <p className="text-sm">Check back as the big day approaches!</p>
      </div>
    )
  }

  return (
    <div className="space-y-16">
      <SectionHeading>Wedding Party</SectionHeading>

      {neutral.length > 0 && <PartyGroup label="Ceremony" members={neutral} />}
      {bride.length > 0 && <PartyGroup label={`${wedding.partnerTwoName}'s side`} members={bride} />}
      {groom.length > 0 && <PartyGroup label={`${wedding.partnerOneName}'s side`} members={groom} />}
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

function PartyGroup({ label, members }: { label: string; members: WeddingPartyMember[] }) {
  return (
    <div>
      <h3 className="text-center text-xs uppercase tracking-[0.2em] text-[#a08060] mb-10">{label}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-10">
        {members.map(member => (
          <div key={member.id} className="text-center">
            {member.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={member.photoUrl}
                alt={member.name}
                className="h-28 w-28 rounded-full object-cover mx-auto mb-4 border-2 border-[#e8dcc8] shadow-sm"
              />
            ) : (
              <div className="h-28 w-28 rounded-full bg-[#f5ede0] border-2 border-[#e8dcc8] flex items-center justify-center mx-auto mb-4">
                <span className="font-serif text-4xl text-[#a08060]">{member.name.charAt(0)}</span>
              </div>
            )}
            <p className="font-serif font-semibold text-[#3b2f2f] text-base leading-snug">{member.name}</p>
            <p className="text-xs text-[#d4af6a] font-medium mt-1 uppercase tracking-wide">{member.role}</p>
            {member.bio && (
              <p className="text-xs text-[#6b5344] mt-2 leading-relaxed">{member.bio}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
